/** Time helpers — we store UTC ISO strings and render in gym timezone. */

import type { IsoUtcString } from "@/lib/domain/types";

export function nowIso(): IsoUtcString {
  return new Date().toISOString();
}

/** Add whole days to an ISO date, returning a new ISO string (UTC). */
export function addDaysIso(iso: IsoUtcString, days: number): IsoUtcString {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Current month key like "2026-06" (used for monthly revenue counter resets). */
export function monthKey(iso: IsoUtcString = nowIso()): string {
  return iso.slice(0, 7);
}
