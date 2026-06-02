/**
 * Service-layer INTEGRATION tests against the Firestore emulator.
 * Exercises the REAL service functions (member create/edit/archive, plan create,
 * onboarding) via the Admin SDK, verifying transactions, member_code allocation,
 * counters, and audit-log writes.
 *
 * The services call getAdminDb()/getAdminAuth(), which initialize the default
 * admin app pointed at FIRESTORE_EMULATOR_HOST. We provide admin env so the
 * config loader marks admin "configured".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

// Point Admin SDK at the emulator + satisfy the config loader BEFORE imports.
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_ADMIN_PROJECT_ID = "gymos-rules-test";
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "svc@gymos-rules-test.iam.gserviceaccount.com";
// Emulator ignores key validity, but the config loader requires a non-empty value.
process.env.FIREBASE_ADMIN_PRIVATE_KEY = "emulator";

import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { createMember, updateMember, archiveMember } from "../src/lib/services/member.service";
import { createPlan, listPlans } from "../src/lib/services/plan.service";

const GYM = "gymSvc";
const actor = { app_user_id: "owner-uid", display_name: "owner@gym.com" };

function db() {
  return getFirestore();
}

beforeAll(async () => {
  // Ensure a DEFAULT admin app exists so our test's direct getFirestore()
  // works — and so it's the SAME default app the services initialize against.
  if (!getApps().length) {
    initializeApp({ projectId: "gymos-rules-test" });
  }
});

afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

beforeEach(async () => {
  await db().recursiveDelete(db().doc(`gym_profiles/${GYM}`));
  await db().doc(`gym_profiles/${GYM}`).set({
    gym_profile_id: GYM,
    gym_display_name: "Iron Test",
    default_currency_code: "INR",
  });
  await db().doc(`gym_profiles/${GYM}/counters/summary`).set({
    gym_profile_id: GYM,
    member_seq: 0,
    total_members: 0,
  });
});

describe("plan.service", () => {
  test("createPlan converts major->minor and stores joining fee", async () => {
    const res = await createPlan(GYM, "INR", {
      plan_display_name: "Quarterly",
      plan_duration_key: "quarterly",
      price_major: 3200,
      joining_fee_major: 1000,
      plan_description: "",
      is_active: true,
      display_order: 0,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.price_amount_minor).toBe(320000);
      expect(res.data.joining_fee_minor).toBe(100000);
      expect(res.data.plan_duration_days).toBe(90);
    }
    const list = await listPlans(GYM, "INR");
    expect(list.ok && list.data.length).toBe(1);
  });
});

describe("member.service", () => {
  test("createMember allocates sequential member_code + bumps counter + logs", async () => {
    const a = await createMember(GYM, "Iron Test", actor, {
      member_display_name: "Aarav",
      member_phone: "+910000000001",
      member_tier_key: "standard",
    });
    const b = await createMember(GYM, "Iron Test", actor, {
      member_display_name: "Priya",
      member_phone: "+910000000002",
      member_tier_key: "standard",
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.data.member.member_code).toMatch(/^IRON-\d{4}-000001$/);
      expect(b.data.member.member_code).toMatch(/^IRON-\d{4}-000002$/);
    }
    // counter
    const counters = await db().doc(`gym_profiles/${GYM}/counters/summary`).get();
    expect(counters.data()?.total_members).toBe(2);
    // audit log written
    const logs = await db().collection(`gym_profiles/${GYM}/activity_logs`).get();
    expect(logs.size).toBeGreaterThanOrEqual(2);
    expect(logs.docs.some((d) => d.data().action_key === "member.create")).toBe(true);
  });

  test("duplicate phone is flagged (warn, not block)", async () => {
    await createMember(GYM, "Iron Test", actor, {
      member_display_name: "Dup1",
      member_phone: "+915555555555",
      member_tier_key: "standard",
    });
    const dup = await createMember(GYM, "Iron Test", actor, {
      member_display_name: "Dup2",
      member_phone: "+915555555555",
      member_tier_key: "standard",
    });
    expect(dup.ok && dup.data.duplicate_warning).toBe(true);
  });

  test("updateMember + archiveMember write audit logs", async () => {
    const created = await createMember(GYM, "Iron Test", actor, {
      member_display_name: "Editable",
      member_phone: "+910000000009",
      member_tier_key: "standard",
    });
    if (!created.ok) throw new Error("setup failed");
    const id = created.data.member.member_id;

    const upd = await updateMember(GYM, id, { member_display_name: "Edited Name" }, actor);
    expect(upd.ok && upd.data.member_display_name).toBe("Edited Name");

    const arch = await archiveMember(GYM, id, actor);
    expect(arch.ok).toBe(true);
    const after = await db().doc(`gym_profiles/${GYM}/members/${id}`).get();
    expect(after.data()?.is_archived).toBe(true);

    const logs = await db().collection(`gym_profiles/${GYM}/activity_logs`).get();
    const actions = logs.docs.map((d) => d.data().action_key);
    expect(actions).toContain("member.edit");
    expect(actions).toContain("member.archive");
  });
});
