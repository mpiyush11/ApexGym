/**
 * Renewal & expiry DATE LOGIC — pure, deterministic, unit-tested.
 *
 * Design decisions (audit 15.1, 15.2):
 *  - Dates are anchored to date-only values at UTC midnight ISO
 *    ("2026-06-01T00:00:00.000Z"). "Today" is resolved in the GYM timezone so
 *    a gym in IST never sees an off-by-one expiry.
 *  - A membership of N days starting on S ends on S + N (exclusive): a member
 *    is active while `now < end_date`. So a 30-day plan from Jun 1 ends Jul 1.
 *  - Renewal continuation: if the member is still active, the new period starts
 *    at the current end_date (no days lost). If expired/none, it starts today.
 *  - These functions NEVER read the clock except through `gymTodayIso`, so they
 *    are fully testable by passing an explicit `todayIso`.
 */

export type DateOnlyIso = string; // "YYYY-MM-DDT00:00:00.000Z"

/** YYYY-MM-DD for "now" in a given IANA timezone (safe fallback to UTC). */
export function gymTodayDateOnly(timezone: string, now: Date = new Date()): string {
  try {
    // en-CA yields YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Convert a YYYY-MM-DD to a UTC-midnight ISO anchor. */
export function dateOnlyToIso(yyyyMmDd: string): DateOnlyIso {
  return `${yyyyMmDd}T00:00:00.000Z`;
}

/** "Today" as a UTC-midnight anchor, computed in the gym timezone. */
export function gymTodayIso(timezone: string, now: Date = new Date()): DateOnlyIso {
  return dateOnlyToIso(gymTodayDateOnly(timezone, now));
}

/** Add whole days to a date-only ISO anchor. */
export function addDaysIso(anchorIso: DateOnlyIso, days: number): DateOnlyIso {
  const d = new Date(anchorIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Whole days from a to b (b - a). Both should be date-only anchors. */
export function daysBetween(aIso: string, bIso: string): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / MS);
}

/**
 * Compute the start + end dates for a new membership period.
 *
 * @param durationDays   plan length in days
 * @param todayIso       today's UTC-midnight anchor (gym tz)
 * @param currentEndIso  current membership end (or null/undefined)
 */
export function computeRenewalPeriod(
  durationDays: number,
  todayIso: DateOnlyIso,
  currentEndIso: string | null | undefined,
): { membership_start_date: DateOnlyIso; membership_end_date: DateOnlyIso } {
  // Still active? Continue from the current end date (no lost days).
  const stillActive =
    currentEndIso != null && new Date(currentEndIso).getTime() > new Date(todayIso).getTime();
  const start = stillActive ? (currentEndIso as DateOnlyIso) : todayIso;
  const end = addDaysIso(start, durationDays);
  return { membership_start_date: start, membership_end_date: end };
}
