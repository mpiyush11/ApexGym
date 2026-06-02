/**
 * Weekly report logic — pure & testable. A report covers a 7-day period ending
 * "today" (gym timezone, resolved by callers). Reports are DERIVED from the
 * immutable membership records (via the monthly rollups/counters); this module
 * only computes the period window + a stable report id.
 */

/** A 7-day window [start, end) as date-only UTC anchors. */
export function weeklyPeriod(todayIso: string): { start: string; end: string } {
  const end = anchorDateOnly(todayIso);
  const d = new Date(end);
  d.setUTCDate(d.getUTCDate() - 7);
  return { start: d.toISOString(), end };
}

function anchorDateOnly(iso: string): string {
  return `${iso.slice(0, 10)}T00:00:00.000Z`;
}

/**
 * Stable, sortable report id from the period end: "report-YYYY-MM-DD".
 * Using the date (not an ISO week number) keeps it simple and human-readable,
 * and makes the weekly cron idempotent (same day → same doc).
 */
export function reportIdForPeriodEnd(endIso: string): string {
  return `report-${endIso.slice(0, 10)}`;
}

/** True if a membership's created_at falls within [start, end). */
export function inPeriod(createdAtIso: string, start: string, end: string): boolean {
  const t = new Date(createdAtIso).getTime();
  return t >= new Date(start).getTime() && t < new Date(end).getTime();
}
