/**
 * Analytics aggregation — PURE & testable.
 *
 * CORE PRINCIPLE (per M5 requirement): analytics are DERIVED from the immutable
 * membership/payment records. There is NO separate financial source of truth.
 * The monthly rollup is a materialized VIEW that is fully reconstructable by
 * `aggregateMemberships()` below — the exact function the rebuild job uses.
 *
 * Revenue is attributed to the month a payment was COLLECTED (membership
 * created_at), which equals the month stored on the immutable membership doc.
 */

export interface MonthlyAgg {
  month_key: string; // "YYYY-MM"
  revenue_collected_minor: number; // Σ amount_paid_minor
  joining_fees_minor: number; // Σ joining_fee_minor
  discount_minor: number; // Σ discount_minor
  periods_count: number; // membership periods created
  new_joins_count: number; // first-ever period per member
}

/** Minimal shape we need from a membership to aggregate (subset of Membership). */
export interface AggMembershipInput {
  member_id: string;
  created_at: string; // ISO
  amount_paid_minor: number;
  joining_fee_minor: number;
  discount_minor: number;
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function emptyAgg(month_key: string): MonthlyAgg {
  return {
    month_key,
    revenue_collected_minor: 0,
    joining_fees_minor: 0,
    discount_minor: 0,
    periods_count: 0,
    new_joins_count: 0,
  };
}

/**
 * Reconstruct ALL monthly rollups purely from membership records.
 * This is the single definition of "truth" for analytics — the live rollup
 * docs must always equal this when recomputed (reconciliation).
 */
export function aggregateMemberships(
  memberships: AggMembershipInput[],
): Map<string, MonthlyAgg> {
  const byMonth = new Map<string, MonthlyAgg>();

  // First period per member = a "new join". Sort by created_at ascending so the
  // earliest membership for each member is detected as the join.
  const firstSeen = new Set<string>();
  const sorted = [...memberships].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  for (const m of sorted) {
    const key = monthKeyOf(m.created_at);
    const agg = byMonth.get(key) ?? emptyAgg(key);
    agg.revenue_collected_minor += Math.round(m.amount_paid_minor || 0);
    agg.joining_fees_minor += Math.round(m.joining_fee_minor || 0);
    agg.discount_minor += Math.round(m.discount_minor || 0);
    agg.periods_count += 1;
    if (!firstSeen.has(m.member_id)) {
      firstSeen.add(m.member_id);
      agg.new_joins_count += 1;
    }
    byMonth.set(key, agg);
  }
  return byMonth;
}

/** The last N month keys ending at `todayIso` (oldest → newest). */
export function lastNMonthKeys(todayIso: string, n: number): string[] {
  const d = new Date(todayIso);
  const keys: string[] = [];
  // Anchor to the first of the month in UTC to avoid drift.
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth(); // 0-based
  for (let i = 0; i < n; i++) {
    const mm = String(m + 1).padStart(2, "0");
    keys.push(`${y}-${mm}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return keys.reverse();
}

/**
 * Align rollups to a fixed window of month keys, filling gaps with zeros so the
 * chart always renders a continuous series.
 */
export function buildMonthlySeries(
  rollups: Map<string, MonthlyAgg>,
  monthKeys: string[],
): MonthlyAgg[] {
  return monthKeys.map((k) => rollups.get(k) ?? emptyAgg(k));
}

/** Renewal rate over a window: renewals / periods (periods = renewals + joins). */
export function renewalRate(series: MonthlyAgg[]): number {
  const periods = series.reduce((s, a) => s + a.periods_count, 0);
  const joins = series.reduce((s, a) => s + a.new_joins_count, 0);
  const renewals = periods - joins;
  if (periods === 0) return 0;
  return Math.round((renewals / periods) * 100);
}

/** Short month label for charts, e.g. "Jun". */
export function monthShortLabel(monthKey: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = Number(monthKey.slice(5, 7));
  return months[m - 1] ?? monthKey;
}
