/**
 * Analytics service (server-only).
 *
 *  - getAnalytics(): FAST read path. Reads the last N monthly rollup docs
 *    (~12 docs) + the counters doc. Cost is O(months), INDEPENDENT of member
 *    count, so it loads in well under 2s even at 5,000+ members.
 *
 *  - rebuildAnalytics(): reconstructs every monthly rollup PURELY from the
 *    immutable membership records (the single source of truth) using the same
 *    aggregateMemberships() the unit tests assert against. Used by an admin/cron
 *    trigger to self-heal the materialized view. This is the ONLY path that
 *    scans memberships, and it never runs on the dashboard read path.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";
import { gymTodayIso } from "@/lib/domain/renewal.logic";
import {
  aggregateMemberships,
  buildMonthlySeries,
  lastNMonthKeys,
  renewalRate,
  type AggMembershipInput,
  type MonthlyAgg,
} from "@/lib/domain/analytics.logic";
import { ok, err, type Result } from "@/lib/utils/result";

export interface AnalyticsResult {
  months: MonthlyAgg[]; // continuous window, oldest → newest
  total_revenue_minor: number; // over the window
  total_new_joins: number;
  renewal_rate_pct: number;
  active_count: number;
  expiring_count: number;
  expired_count: number;
  total_members: number;
  currency_code: string;
  window_months: number;
}

export async function getAnalytics(
  gym_profile_id: string,
  currency_code: string,
  gym_timezone: string,
  windowMonths = 12,
): Promise<Result<AnalyticsResult>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const todayIso = gymTodayIso(gym_timezone);
    const keys = lastNMonthKeys(todayIso, windowMonths);

    // Read exactly the rollup docs in the window + counters (bounded, O(months)).
    const rollupCol = db.collection(path.analyticsMonthly(gym_profile_id));
    const [rollupSnaps, countersSnap] = await Promise.all([
      Promise.all(keys.map((k) => rollupCol.doc(k).get())),
      db.doc(path.counters(gym_profile_id)).get(),
    ]);

    const map = new Map<string, MonthlyAgg>();
    for (const snap of rollupSnaps) {
      if (snap.exists) {
        const d = snap.data()!;
        map.set(d.month_key, {
          month_key: d.month_key,
          revenue_collected_minor: Number(d.revenue_collected_minor) || 0,
          joining_fees_minor: Number(d.joining_fees_minor) || 0,
          discount_minor: Number(d.discount_minor) || 0,
          periods_count: Number(d.periods_count) || 0,
          new_joins_count: Number(d.new_joins_count) || 0,
        });
      }
    }
    const months = buildMonthlySeries(map, keys);
    const c = countersSnap.exists ? countersSnap.data() ?? {} : {};

    return ok({
      months,
      total_revenue_minor: months.reduce((s, m) => s + m.revenue_collected_minor, 0),
      total_new_joins: months.reduce((s, m) => s + m.new_joins_count, 0),
      renewal_rate_pct: renewalRate(months),
      active_count: Number(c.active_count) || 0,
      expiring_count: Number(c.expiring_count) || 0,
      expired_count: Number(c.expired_count) || 0,
      total_members: Number(c.total_members) || 0,
      currency_code,
      window_months: windowMonths,
    });
  } catch {
    return err("internal", "Could not load analytics.");
  }
}

export interface RebuildSummary {
  memberships_scanned: number;
  months_written: number;
}

/**
 * Reconstruct ALL monthly rollups from the immutable membership records.
 * Uses a collection-group query scoped to this tenant by gym_profile_id.
 */
export async function rebuildAnalytics(
  gym_profile_id: string,
  currency_code: string,
): Promise<Result<RebuildSummary>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const snap = await db
      .collectionGroup(SUBCOLLECTIONS.MEMBERSHIPS)
      .where("gym_profile_id", "==", gym_profile_id)
      .get();

    const inputs: AggMembershipInput[] = snap.docs.map((d) => {
      const m = d.data();
      return {
        member_id: String(m.member_id),
        created_at: String(m.created_at),
        amount_paid_minor: Number(m.amount_paid_minor) || 0,
        joining_fee_minor: Number(m.joining_fee_minor) || 0,
        discount_minor: Number(m.discount_minor) || 0,
      };
    });

    const rollups = aggregateMemberships(inputs);
    const now = nowIso();

    // Batch-write the rebuilt rollups (idempotent overwrite).
    let batch = db.batch();
    let ops = 0;
    for (const [month_key, agg] of rollups) {
      batch.set(db.doc(path.analyticsMonth(gym_profile_id, month_key)), {
        ...agg,
        gym_profile_id,
        currency_code,
        updated_at: now,
      });
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return ok({ memberships_scanned: snap.size, months_written: rollups.size });
  } catch {
    return err("internal", "Analytics rebuild failed. A collection-group index may be required.");
  }
}

export { COLLECTIONS };
