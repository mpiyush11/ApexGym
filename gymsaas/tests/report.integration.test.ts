/**
 * Reports INTEGRATION test (Firestore emulator). Verifies the weekly report is
 * DERIVED from existing membership records + counters (no parallel ledger), is
 * idempotent per day, and that suspended gyms are blocked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_ADMIN_PROJECT_ID = "gymos-rules-test";
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "svc@gymos-rules-test.iam.gserviceaccount.com";
process.env.FIREBASE_ADMIN_PRIVATE_KEY = "emulator";

import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateWeeklyReport, listReports } from "../src/lib/services/report.service";

const GYM = "gymReports";

function db() {
  return getFirestore();
}

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "gymos-rules-test" });
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function seed(opts: { suspended?: boolean } = {}) {
  await db().recursiveDelete(db().doc(`gym_profiles/${GYM}`));
  await db().doc(`gym_profiles/${GYM}`).set({
    gym_profile_id: GYM,
    gym_display_name: "Reports Gym",
    default_currency_code: "INR",
    gym_timezone: "Asia/Kolkata",
    gym_status_key: opts.suspended ? "suspended" : "active",
  });
  await db().doc(`gym_profiles/${GYM}/counters/summary`).set({
    gym_profile_id: GYM,
    active_count: 42,
    expiring_count: 5,
    expired_count: 3,
    lead_new_count: 7,
  });
}

async function addMembership(id: string, createdAt: string, paid: number, joiningFee: number) {
  await db().doc(`gym_profiles/${GYM}/members/m_${id}/memberships/${id}`).set({
    membership_id: id,
    gym_profile_id: GYM,
    member_id: `m_${id}`,
    plan_name_snapshot: "Quarterly",
    amount_paid_minor: paid,
    joining_fee_minor: joiningFee,
    membership_start_date: createdAt,
    membership_end_date: createdAt,
    created_at: createdAt,
  });
}

beforeEach(async () => {
  await seed();
});

describe("generateWeeklyReport (derived)", () => {
  test("sums revenue + splits joins/renewals from in-window memberships", async () => {
    await addMembership("a", isoDaysAgo(1), 300000, 100000); // join (joining fee)
    await addMembership("b", isoDaysAgo(2), 300000, 0);      // renewal
    await addMembership("c", isoDaysAgo(3), 300000, 0);      // renewal
    await addMembership("old", isoDaysAgo(30), 999999, 0);   // outside window

    const res = await generateWeeklyReport(GYM);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.revenue_period_minor).toBe(900000); // excludes the old one
    expect(res.data.new_joins).toBe(1);
    // point-in-time counts come from counters
    expect(res.data.active_members).toBe(42);
    expect(res.data.expiring_count).toBe(5);
    expect(res.data.lead_new).toBe(7);
  });

  test("is idempotent per day (same report id overwrites, no duplicates)", async () => {
    await addMembership("a", isoDaysAgo(1), 300000, 0);
    await generateWeeklyReport(GYM);
    await generateWeeklyReport(GYM);
    const list = await listReports(GYM);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBe(1);
  });

  test("suspended gym is blocked", async () => {
    // Distinct gym id so the short-lived suspension cache isn't primed active.
    const SG = "gymReportsSusp";
    await db().doc(`gym_profiles/${SG}`).set({
      gym_profile_id: SG,
      gym_display_name: "Susp",
      default_currency_code: "INR",
      gym_timezone: "Asia/Kolkata",
      gym_status_key: "suspended",
    });
    const res = await generateWeeklyReport(SG);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("suspended");
  });
});
