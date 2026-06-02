/** Dashboard summary — reads the O(1) counters doc (no collection scans). */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path } from "@/lib/firebase/paths";
import { monthKey, nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";

export interface DashboardSummary {
  active_count: number;
  expiring_count: number;
  expired_count: number;
  total_members: number;
  lead_new_count: number;
  revenue_month_minor: number;
  revenue_month_key: string;
  currency_code: string;
}

export async function getDashboardSummary(
  gym_profile_id: string,
  currency_code: string,
): Promise<Result<DashboardSummary>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const thisMonth = monthKey(nowIso());
    // Operational counts from the counters doc; revenue from the DERIVED monthly
    // rollup (single financial source of truth). Two O(1) reads — independent of
    // member count, so the dashboard stays fast at 5,000+ members.
    const [countersSnap, rollupSnap] = await Promise.all([
      db.doc(path.counters(gym_profile_id)).get(),
      db.doc(path.analyticsMonth(gym_profile_id, thisMonth)).get(),
    ]);
    const d = countersSnap.exists ? countersSnap.data() ?? {} : {};
    const revenue = rollupSnap.exists
      ? Number(rollupSnap.data()?.revenue_collected_minor) || 0
      : 0;
    return ok({
      active_count: Number(d.active_count) || 0,
      expiring_count: Number(d.expiring_count) || 0,
      expired_count: Number(d.expired_count) || 0,
      total_members: Number(d.total_members) || 0,
      lead_new_count: Number(d.lead_new_count) || 0,
      revenue_month_minor: revenue,
      revenue_month_key: thisMonth,
      currency_code,
    });
  } catch {
    return err("internal", "Could not load dashboard summary.");
  }
}
