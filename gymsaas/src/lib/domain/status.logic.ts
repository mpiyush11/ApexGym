/**
 * Member status derivation — pure & testable. Status is DERIVED, never hand-set
 * (audit 3.3 / 6.2). Computed live in lists AND persisted by the daily cron so
 * counters stay O(1) and accurate.
 *
 *   active        -> end_date > today  AND not within reminder window
 *   expiring_soon -> today <= end_date AND within `reminderDays` of end
 *   expired       -> end_date <= today
 *   inactive      -> no membership ever / archived
 */
import {
  MEMBER_STATUS_KEYS,
  type MemberStatusKey,
} from "./constants";
import { daysBetween } from "./renewal.logic";

export function deriveMemberStatus(
  membershipEndDateIso: string | null | undefined,
  todayIso: string,
  reminderDays: number,
): MemberStatusKey {
  if (!membershipEndDateIso) return MEMBER_STATUS_KEYS.INACTIVE;
  const daysLeft = daysBetween(todayIso, membershipEndDateIso);
  if (daysLeft <= 0) return MEMBER_STATUS_KEYS.EXPIRED;
  if (daysLeft <= reminderDays) return MEMBER_STATUS_KEYS.EXPIRING_SOON;
  return MEMBER_STATUS_KEYS.ACTIVE;
}

/** Days remaining (negative if expired). Useful for UI badges. */
export function daysUntilExpiry(
  membershipEndDateIso: string | null | undefined,
  todayIso: string,
): number | null {
  if (!membershipEndDateIso) return null;
  return daysBetween(todayIso, membershipEndDateIso);
}
