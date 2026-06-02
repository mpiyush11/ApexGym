/**
 * Onboarding INTEGRATION test (Firestore + Auth emulators).
 *
 * Verifies the server side of the Critical onboarding fix:
 *   - createTenantForUser creates the gym_profile, a UNIQUE gym_slug index,
 *     settings + counters singletons, and the owner app_user
 *   - it sets owner custom claims (gym_profile_id + role) on the auth user
 *   - a second gym cannot steal the same slug (global uniqueness)
 *   - a user already linked to a gym cannot create another
 *
 * The client re-mints the session cookie after this (covered in the page); here
 * we prove claims are actually set so that re-mint surfaces them.
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
import { createTenantForUser } from "../src/lib/services/onboarding.service";

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "gymos-rules-test" });
});

afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

async function freshUser(email: string): Promise<string> {
  const auth = getAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.deleteUser(existing.uid);
  } catch {
    /* no existing user */
  }
  const u = await auth.createUser({ email });
  return u.uid;
}

const baseInput = {
  gym_display_name: "Iron Paradise",
  owner_display_name: "Owner One",
  default_currency_code: "INR",
  gym_timezone: "Asia/Kolkata",
};

describe("onboarding.service", () => {
  beforeEach(async () => {
    // Clear the slug index that enforces global uniqueness.
    const db = getFirestore();
    await db.recursiveDelete(db.collection("gym_slug_index"));
  });

  test("creates tenant, slug index, singletons + sets owner claims", async () => {
    const uid = await freshUser("owner1@test.com");
    const res = await createTenantForUser(uid, "owner1@test.com", { ...baseInput });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const db = getFirestore();
    const { gym_profile_id, gym_slug } = res.data;

    const profile = await db.doc(`gym_profiles/${gym_profile_id}`).get();
    expect(profile.exists).toBe(true);
    expect(profile.data()?.gym_status_key).toBe("active");

    const slugIdx = await db.doc(`gym_slug_index/${gym_slug}`).get();
    expect(slugIdx.data()?.gym_profile_id).toBe(gym_profile_id);

    const counters = await db.doc(`gym_profiles/${gym_profile_id}/counters/summary`).get();
    expect(counters.exists).toBe(true);
    const settings = await db.doc(`gym_profiles/${gym_profile_id}/settings/settings`).get();
    expect(settings.exists).toBe(true);

    // Owner claims set on the auth user (this is what the session re-mint reads).
    const user = await getAuth().getUser(uid);
    expect(user.customClaims?.gym_profile_id).toBe(gym_profile_id);
    expect(user.customClaims?.role).toBe("owner");
  });

  test("a user already linked to a gym cannot create another", async () => {
    const uid = await freshUser("owner2@test.com");
    const first = await createTenantForUser(uid, "owner2@test.com", {
      ...baseInput,
      gym_display_name: "First Gym",
    });
    expect(first.ok).toBe(true);
    const second = await createTenantForUser(uid, "owner2@test.com", {
      ...baseInput,
      gym_display_name: "Second Gym",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("conflict");
  });

  test("global slug uniqueness: two gyms cannot share a slug", async () => {
    const uidA = await freshUser("ownerA@test.com");
    const uidB = await freshUser("ownerB@test.com");
    const a = await createTenantForUser(uidA, "ownerA@test.com", {
      ...baseInput,
      gym_display_name: "Same Name Gym",
    });
    const b = await createTenantForUser(uidB, "ownerB@test.com", {
      ...baseInput,
      gym_display_name: "Same Name Gym",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error.code).toBe("conflict");
  });
});
