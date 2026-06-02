/**
 * Reports service (server-only). Owner-only at the API layer.
 *
 *  - generateWeeklyReport: builds a weekly snapshot into the EXISTING
 *    `report_runs` collection. Metrics are DERIVED:
 *      • point-in-time counts (active/expiring/expired/lead_new) from `counters`
 *      • period revenue + joins + renewals from a BOUNDED read of memberships
 *        created in the last 7 days (small set) — memberships remain the only
 *        financial source of truth; we never store a parallel ledger.
 *  - listReports: bounded history (auto single-field index on created_at).
 *
 * No new collections/indexes. Idempotent per day (report id = date).
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";
import { gymTodayIso } from "@/lib/domain/renewal.logic";
import { weeklyPeriod, reportIdForPeriodEnd, inPeriod } from "@/lib/domain/report.logic";
import { ok, err, type Result } from "@/lib/utils/result";
import { isGymSuspended } from "./gym.server";
import { getGymBasics } from "./gym.server";
import type { ReportRun, Membership } from "@/lib/domain/types";

export async function generateWeeklyReport(
  gym_profile_id: string,
): Promise<Result<ReportRun>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  if (await isGymSuspended(gym_profile_id)) {
    return err("suspended", "This gym account is suspended.");
  }

  const basics = await getGymBasics(gym_profile_id);
  const todayIso = gymTodayIso(basics.gym_timezone);
  const { start, end } = weeklyPeriod(todayIso);
  const report_run_id = reportIdForPeriodEnd(end);

  try {
    // Point-in-time counts from the O(1) counters doc.
    const countersSnap = await db.doc(path.counters(gym_profile_id)).get();
    const c = countersSnap.exists ? countersSnap.data() ?? {} : {};

    // Period figures: bounded read of memberships created in the last 7 days.
    // Uses a collection-group query scoped to this tenant (existing index).
    const msSnap = await db
      .collectionGroup(SUBCOLLECTIONS.MEMBERSHIPS)
      .where("gym_profile_id", "==", gym_profile_id)
      .where("created_at", ">=", start)
      .get();

    // Bounded in-window set (the >= start query is inclusive; filter exact end).
    const periods = msSnap.docs
      .map((d) => d.data() as Membership)
      .filter((m) => inPeriod(m.created_at, start, end));

    // Revenue collected in the window = Σ amount_paid_minor (integer minor units).
    const revenue_period_minor = periods.reduce(
      (sum, m) => sum + (Number(m.amount_paid_minor) || 0),
      0,
    );
    // A "new join" charges the one-time joining fee in our renewal flow, so a
    // period with joining_fee_minor > 0 is a first join; the rest are renewals.
    const new_joins = periods.filter((m) => (m.joining_fee_minor || 0) > 0).length;
    const renewals = periods.length - new_joins;

    const report: ReportRun = {
      report_run_id,
      gym_profile_id,
      report_period_start: start,
      report_period_end: end,
      active_members: Number(c.active_count) || 0,
      new_joins,
      expiring_count: Number(c.expiring_count) || 0,
      revenue_period_minor,
      lead_new: Number(c.lead_new_count) || 0,
      lead_converted: 0, // derived metric reserved; not tracked separately in V1
      delivery_status_key: "generated",
      created_at: nowIso(),
    };

    await db
      .doc(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.REPORT_RUNS}/${report_run_id}`)
      .set(report);

    // Attach a couple of extra derived fields for the UI without schema bloat.
    return ok({ ...report, ...{ renewals, periods_count: periods.length } } as ReportRun);
  } catch {
    return err("internal", "Could not generate the report.");
  }
}

export async function listReports(
  gym_profile_id: string,
  limit = 12,
): Promise<Result<ReportRun[]>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const snap = await db
      .collection(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.REPORT_RUNS}`)
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();
    return ok(snap.docs.map((d) => d.data() as ReportRun));
  } catch {
    return err("internal", "Could not load reports.");
  }
}
