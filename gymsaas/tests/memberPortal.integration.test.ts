/**
 * Member portal INTEGRATION test (Firestore + Auth emulators).
 *
 * Proves the three required edge cases for member login binding + the card:
 *   1. Duplicate member_phone in the same gym -> NO auto-select; fail + log.
 *   2. Existing member_auth_uid (different UID) -> NO silent rebind; preserved.
 *   3. Suspended gym -> login AND card blocked with the SAME `suspended` code.
 * Plus: happy-path bind sets claims + stamps uid; idempotent re-bind of same uid.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.FIREBASE_ADMIN_PROJECT_ID = "gymos-rules-test";
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "svc@gymos-rules-test.iam.gserviceaccount.com";
process.env.FIREBASE_ADMIN_PRIVATE_KEY = "emulator";

import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { bindMemberLogin, getMemberCard } from "../src/lib/services/memberPortal.service";

const GYM = "gymPortal";
const SLUG = "portal-gym";

function db() {
  return getFirestore();
}

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "gymos-rules-test" });
});
afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

async function freshUser(): Promise<string> {
  const u = await getAuth().createUser({});
  return u.uid;
}

async function seedGym(opts: { suspended?: boolean } = {}) {
  await db().recursiveDelete(db().doc(`gym_profiles/${GYM}`));
  await db().doc(`gym_profiles/${GYM}`).set({
    gym_profile_id: GYM,
    gym_slug: SLUG,
    gym_display_name: "Portal Gym",
    default_currency_code: "INR",
    gym_status_key: opts.suspended ? "suspended" : "active",
  });
  await db().doc(`gym_slug_index/${SLUG}`).set({ gym_profile_id: GYM });
}

async function seedMember(id: string, phone: string, extra: Record<string, unknown> = {}) {
  await db().doc(`gym_profiles/${GYM}/members/${id}`).set({
    member_id: id,
    gym_profile_id: GYM,
    member_code: `PRT-2026-${id}`,
    member_display_name: `Member ${id}`,
    member_phone: phone,
    member_join_date: "2026-01-01T00:00:00.000Z",
    member_status_key: "active",
    is_archived: false,
    current_membership_summary: {
      membership_id: "ms1",
      plan_name_snapshot: "Quarterly",
      membership_end_date: "2026-09-01T00:00:00.000Z",
      member_status_key: "active",
      amount_due_minor: 0,
    },
    ...extra,
  });
}

beforeEach(async () => {
  await seedGym();
});

describe("Edge case 1 — duplicate phone in same gym", () => {
  test("does NOT auto-select; fails with conflict + logs", async () => {
    await seedMember("dupA", "+910000001111");
    await seedMember("dupB", "+910000001111");
    const uid = await freshUser();

    const res = await bindMemberLogin(SLUG, uid, "+910000001111");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("conflict");

    // No claims set (not auto-selected).
    const user = await getAuth().getUser(uid);
    expect(user.customClaims?.member_id).toBeUndefined();

    // Event logged.
    const logs = await db().collection(`gym_profiles/${GYM}/activity_logs`).get();
    expect(logs.docs.some((d) => d.data().action_key === "member.login_ambiguous")).toBe(true);
  });
});

describe("Edge case 2 — existing member_auth_uid", () => {
  test("does NOT silently rebind to a different UID; original preserved", async () => {
    await seedMember("bound1", "+910000002222", { member_auth_uid: "original-uid" });
    const newUid = await freshUser();

    const res = await bindMemberLogin(SLUG, newUid, "+910000002222");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("conflict");

    // Original binding preserved.
    const m = await db().doc(`gym_profiles/${GYM}/members/bound1`).get();
    expect(m.data()?.member_auth_uid).toBe("original-uid");

    const logs = await db().collection(`gym_profiles/${GYM}/activity_logs`).get();
    expect(logs.docs.some((d) => d.data().action_key === "member.login_rebind_blocked")).toBe(true);
  });

  test("re-bind of the SAME uid is idempotent (allowed)", async () => {
    const uid = await freshUser();
    await seedMember("self1", "+910000003333", { member_auth_uid: uid });
    const res = await bindMemberLogin(SLUG, uid, "+910000003333");
    expect(res.ok).toBe(true);
  });
});

describe("Edge case 3 — suspended gym (consistent block)", () => {
  // Use distinct gym ids so the short-lived suspension cache (keyed by
  // gym_profile_id) can't be primed as "active" by earlier tests.
  async function seedSuspendedGym(id: string, slug: string) {
    await db().doc(`gym_profiles/${id}`).set({
      gym_profile_id: id,
      gym_slug: slug,
      gym_display_name: "Suspended Gym",
      default_currency_code: "INR",
      gym_status_key: "suspended",
    });
    await db().doc(`gym_slug_index/${slug}`).set({ gym_profile_id: id });
  }

  test("login blocked with suspended", async () => {
    await seedSuspendedGym("gymSusp1", "susp-1");
    await db().doc(`gym_profiles/gymSusp1/members/s1`).set({
      member_id: "s1", gym_profile_id: "gymSusp1", member_code: "S-1",
      member_display_name: "S1", member_phone: "+910000004444", is_archived: false,
    });
    const uid = await freshUser();
    const res = await bindMemberLogin("susp-1", uid, "+910000004444");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("suspended");
  });

  test("card blocked with the SAME suspended code", async () => {
    await seedSuspendedGym("gymSusp2", "susp-2");
    await db().doc(`gym_profiles/gymSusp2/members/s2`).set({
      member_id: "s2", gym_profile_id: "gymSusp2", member_code: "S-2",
      member_display_name: "S2", member_phone: "+910000005555", is_archived: false,
    });
    const res = await getMemberCard("gymSusp2", "s2");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("suspended");
  });
});

describe("Happy path — bind + card from existing records", () => {
  test("binds, sets claims, stamps uid, returns card", async () => {
    await seedMember("happy1", "+910000006666");
    const uid = await freshUser();

    const bind = await bindMemberLogin(SLUG, uid, "+910000006666");
    expect(bind.ok).toBe(true);

    // Claims set to member of this gym.
    const user = await getAuth().getUser(uid);
    expect(user.customClaims?.role).toBe("member");
    expect(user.customClaims?.gym_profile_id).toBe(GYM);
    expect(user.customClaims?.member_id).toBe("happy1");

    // uid stamped on the member.
    const m = await db().doc(`gym_profiles/${GYM}/members/happy1`).get();
    expect(m.data()?.member_auth_uid).toBe(uid);

    // Card derives from existing records.
    const card = await getMemberCard(GYM, "happy1");
    expect(card.ok).toBe(true);
    if (card.ok) {
      expect(card.data.member_code).toBe("PRT-2026-happy1");
      expect(card.data.plan_name_snapshot).toBe("Quarterly");
      expect(card.data.member_status_key).toBe("active");
    }
  });

  test("unknown phone -> not_found (no bind)", async () => {
    const uid = await freshUser();
    const res = await bindMemberLogin(SLUG, uid, "+919999999999");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("not_found");
  });
});
