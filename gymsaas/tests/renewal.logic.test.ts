/**
 * Pure logic tests for renewal dates + status derivation (no emulator needed).
 * These guard the highest-priority correctness: expiry math, continuation,
 * timezone day-boundary, and status buckets.
 */
import { describe, test, expect } from "vitest";
import {
  computeRenewalPeriod,
  addDaysIso,
  daysBetween,
  dateOnlyToIso,
  gymTodayDateOnly,
} from "../src/lib/domain/renewal.logic";
import { deriveMemberStatus, daysUntilExpiry } from "../src/lib/domain/status.logic";

const iso = (d: string) => dateOnlyToIso(d);

describe("date helpers", () => {
  test("addDaysIso adds whole days at UTC midnight", () => {
    expect(addDaysIso(iso("2026-06-01"), 30)).toBe("2026-07-01T00:00:00.000Z");
  });
  test("daysBetween computes b - a", () => {
    expect(daysBetween(iso("2026-06-01"), iso("2026-07-01"))).toBe(30);
    expect(daysBetween(iso("2026-07-01"), iso("2026-06-01"))).toBe(-30);
  });
});

describe("computeRenewalPeriod", () => {
  const today = iso("2026-06-15");

  test("fresh join (no current membership) starts today", () => {
    const r = computeRenewalPeriod(30, today, null);
    expect(r.membership_start_date).toBe(today);
    expect(r.membership_end_date).toBe("2026-07-15T00:00:00.000Z");
  });

  test("expired member starts today (does not back-date)", () => {
    const r = computeRenewalPeriod(30, today, iso("2026-06-01")); // already past
    expect(r.membership_start_date).toBe(today);
  });

  test("active member CONTINUES from current end (no lost days)", () => {
    const currentEnd = iso("2026-06-30"); // still active on Jun 15
    const r = computeRenewalPeriod(30, today, currentEnd);
    expect(r.membership_start_date).toBe(currentEnd);
    expect(r.membership_end_date).toBe("2026-07-30T00:00:00.000Z");
  });

  test("quarterly = 90 days", () => {
    const r = computeRenewalPeriod(90, today, null);
    expect(daysBetween(r.membership_start_date, r.membership_end_date)).toBe(90);
  });
});

describe("deriveMemberStatus", () => {
  const today = iso("2026-06-15");
  const reminder = 7;

  test("no membership -> inactive", () => {
    expect(deriveMemberStatus(null, today, reminder)).toBe("inactive");
  });
  test("end in the past -> expired", () => {
    expect(deriveMemberStatus(iso("2026-06-10"), today, reminder)).toBe("expired");
  });
  test("end today (0 days left) -> expired", () => {
    expect(deriveMemberStatus(today, today, reminder)).toBe("expired");
  });
  test("end within reminder window -> expiring_soon", () => {
    expect(deriveMemberStatus(iso("2026-06-20"), today, reminder)).toBe("expiring_soon");
  });
  test("end far away -> active", () => {
    expect(deriveMemberStatus(iso("2026-07-30"), today, reminder)).toBe("active");
  });
  test("exactly at reminder boundary -> expiring_soon", () => {
    expect(deriveMemberStatus(iso("2026-06-22"), today, reminder)).toBe("expiring_soon"); // 7 days
  });
  test("one day past reminder boundary -> active", () => {
    expect(deriveMemberStatus(iso("2026-06-23"), today, reminder)).toBe("active"); // 8 days
  });
});

describe("daysUntilExpiry", () => {
  test("returns null when no membership", () => {
    expect(daysUntilExpiry(null, iso("2026-06-15"))).toBeNull();
  });
  test("negative when expired", () => {
    expect(daysUntilExpiry(iso("2026-06-10"), iso("2026-06-15"))).toBe(-5);
  });
});

describe("timezone day boundary", () => {
  test("IST resolves the local calendar day, not UTC", () => {
    // 2026-06-15T19:30:00Z is 2026-06-16 01:00 IST -> local day is the 16th.
    const at = new Date("2026-06-15T19:30:00.000Z");
    expect(gymTodayDateOnly("Asia/Kolkata", at)).toBe("2026-06-16");
    expect(gymTodayDateOnly("UTC", at)).toBe("2026-06-15");
  });
  test("invalid timezone falls back to UTC (no throw)", () => {
    const at = new Date("2026-06-15T10:00:00.000Z");
    expect(gymTodayDateOnly("Not/AZone", at)).toBe("2026-06-15");
  });
});
