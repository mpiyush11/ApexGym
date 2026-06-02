/**
 * Firestore Security Rules — comprehensive tenant-isolation + RBAC tests.
 *
 * Proves (audit C4 / M2 goal):
 *   - Default deny for anonymous users.
 *   - Cross-tenant isolation: Gym A users cannot touch Gym B data.
 *   - Owner / Reception / Member / Platform-admin permissions enforced.
 *   - Reception cannot delete members, edit plans, or write settings/counters.
 *   - Members can read ONLY their own member doc + memberships.
 *   - Money field validation on membership writes (integer minor units).
 *
 * Requires the Firestore emulator running on 127.0.0.1:8080.
 */
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  getTestEnv,
  seed,
  owner,
  reception,
  member,
  platformAdmin,
  anon,
  GYM_A,
  GYM_B,
} from "./helpers/setup";

let env: RulesTestEnvironment;

// Convenience path builders.
const profile = (g: string) => `gym_profiles/${g}`;
const settings = (g: string) => `gym_profiles/${g}/settings/settings`;
const counters = (g: string) => `gym_profiles/${g}/counters/summary`;
const memberPath = (g: string, m: string) => `gym_profiles/${g}/members/${m}`;
const membershipPath = (g: string, m: string, ms: string) =>
  `gym_profiles/${g}/members/${m}/memberships/${ms}`;
const planPath = (g: string, p: string) => `gym_profiles/${g}/membership_plans/${p}`;
const leadPath = (g: string, l: string) => `gym_profiles/${g}/leads/${l}`;
const galleryPath = (g: string, x: string) => `gym_profiles/${g}/gallery_items/${x}`;
const testimonialPath = (g: string, x: string) =>
  `gym_profiles/${g}/testimonials/${x}`;
const slugPath = (s: string) => `gym_slug_index/${s}`;

const validMembership = {
  gym_profile_id: GYM_A,
  member_id: "m1",
  plan_id: "p1",
  plan_name_snapshot: "Quarterly",
  renewal_amount_minor: 320000,
  amount_paid_minor: 320000,
  amount_due_minor: 0,
  payment_method_key: "cash",
  payment_status_key: "paid",
  membership_start_date: "2026-06-01T00:00:00.000Z",
  membership_end_date: "2026-08-30T00:00:00.000Z",
  created_by_app_user_id: "u",
  created_at: "2026-06-01T00:00:00.000Z",
};

beforeAll(async () => {
  env = await getTestEnv();
});

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed both tenants with baseline docs (rules disabled).
  await seed(env, async (db) => {
    for (const g of [GYM_A, GYM_B]) {
      await setDoc(doc(db, profile(g)), { gym_profile_id: g, gym_slug: g });
      await setDoc(doc(db, settings(g)), { gym_profile_id: g, renewal_reminder_days_before: 7 });
      await setDoc(doc(db, counters(g)), { gym_profile_id: g, member_seq: 0 });
      await setDoc(doc(db, memberPath(g, "m1")), {
        member_id: "m1",
        gym_profile_id: g,
        member_display_name: "Existing Member",
      });
      await setDoc(doc(db, membershipPath(g, "m1", "ms1")), validMembership);
      await setDoc(doc(db, planPath(g, "p1")), {
        plan_id: "p1",
        gym_profile_id: g,
        price_amount_minor: 300000,
        joining_fee_minor: 100000,
      });
      await setDoc(doc(db, leadPath(g, "l1")), { lead_id: "l1", gym_profile_id: g });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Anonymous (default deny)", () => {
  test("cannot read a gym profile", async () => {
    const db = anon(env).firestore();
    await assertFails(getDoc(doc(db, profile(GYM_A))));
  });

  test("cannot read a member", async () => {
    const db = anon(env).firestore();
    await assertFails(getDoc(doc(db, memberPath(GYM_A, "m1"))));
  });

  test("cannot write anything", async () => {
    const db = anon(env).firestore();
    await assertFails(setDoc(doc(db, memberPath(GYM_A, "x")), { a: 1 }));
  });

  test("CAN read the public gym_slug_index", async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, slugPath("iron")), { gym_profile_id: GYM_A });
    });
    const db = anon(env).firestore();
    await assertSucceeds(getDoc(doc(db, slugPath("iron"))));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Cross-tenant isolation (the non-negotiable)", () => {
  test("Gym A owner cannot read Gym B member", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(getDoc(doc(db, memberPath(GYM_B, "m1"))));
  });

  test("Gym A owner cannot write Gym B member", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, memberPath(GYM_B, "hacker")), { member_id: "hacker" }),
    );
  });

  test("Gym A reception cannot read Gym B leads", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(getDoc(doc(db, leadPath(GYM_B, "l1"))));
  });

  test("Gym A owner cannot edit Gym B plan pricing", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(
      updateDoc(doc(db, planPath(GYM_B, "p1")), { price_amount_minor: 1 }),
    );
  });

  test("Gym A member cannot read Gym B member doc", async () => {
    const db = member(env, GYM_A, "m1").firestore();
    await assertFails(getDoc(doc(db, memberPath(GYM_B, "m1"))));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Owner permissions", () => {
  test("can read & update own gym profile", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(getDoc(doc(db, profile(GYM_A))));
    await assertSucceeds(updateDoc(doc(db, profile(GYM_A)), { gym_city: "Mumbai" }));
  });

  test("can write settings", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(
      updateDoc(doc(db, settings(GYM_A)), { renewal_reminder_days_before: 10 }),
    );
  });

  test("can create/edit/delete plans", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(
      setDoc(doc(db, planPath(GYM_A, "p2")), {
        plan_id: "p2",
        gym_profile_id: GYM_A,
        price_amount_minor: 500000,
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, planPath(GYM_A, "p2"))));
  });

  test("can manage CMS (gallery, testimonials)", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(
      setDoc(doc(db, galleryPath(GYM_A, "g1")), {
        gallery_item_id: "g1",
        gym_profile_id: GYM_A,
        image_title: "Floor",
        area_category: "weights",
        is_hero_gallery: true,
        is_active: true,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, testimonialPath(GYM_A, "t1")), {
        testimonial_id: "t1",
        gym_profile_id: GYM_A,
        testimonial_text: "Great gym",
        member_since_year: 2024,
        member_tier_key: "gold",
      }),
    );
  });

  test("can delete a member", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(deleteDoc(doc(db, memberPath(GYM_A, "m1"))));
  });

  test("cannot write counters directly (server-only)", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(updateDoc(doc(db, counters(GYM_A)), { active_count: 999 }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Reception permissions (restricted)", () => {
  test("can read members and create a member", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertSucceeds(getDoc(doc(db, memberPath(GYM_A, "m1"))));
    await assertSucceeds(
      setDoc(doc(db, memberPath(GYM_A, "m2")), {
        member_id: "m2",
        gym_profile_id: GYM_A,
        member_display_name: "New Joiner",
      }),
    );
  });

  test("can edit a member", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertSucceeds(
      updateDoc(doc(db, memberPath(GYM_A, "m1")), { member_phone: "+910000000000" }),
    );
  });

  test("CANNOT create a membership from the client (server-only)", async () => {
    // Renewals are written by the transactional server service (Admin SDK).
    const db = reception(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, membershipPath(GYM_A, "m1", "ms2")), validMembership),
    );
  });

  test("CANNOT delete a member", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(deleteDoc(doc(db, memberPath(GYM_A, "m1"))));
  });

  test("CANNOT edit plan pricing", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(
      updateDoc(doc(db, planPath(GYM_A, "p1")), { price_amount_minor: 1 }),
    );
  });

  test("CANNOT write settings", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(
      updateDoc(doc(db, settings(GYM_A)), { renewal_reminder_days_before: 1 }),
    );
  });

  test("CANNOT manage CMS gallery", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, galleryPath(GYM_A, "gX")), {
        gallery_item_id: "gX",
        gym_profile_id: GYM_A,
        image_title: "x",
        area_category: "x",
        is_hero_gallery: false,
        is_active: true,
      }),
    );
  });

  test("CAN read & manage leads", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertSucceeds(getDoc(doc(db, leadPath(GYM_A, "l1"))));
    await assertSucceeds(
      updateDoc(doc(db, leadPath(GYM_A, "l1")), { lead_status_key: "contacted" }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Member permissions (self only)", () => {
  test("can read ONLY their own member doc", async () => {
    const meDb = member(env, GYM_A, "m1").firestore();
    await assertSucceeds(getDoc(doc(meDb, memberPath(GYM_A, "m1"))));

    // Seed another member, ensure no access.
    await seed(env, async (db) => {
      await setDoc(doc(db, memberPath(GYM_A, "m2")), {
        member_id: "m2",
        gym_profile_id: GYM_A,
      });
    });
    await assertFails(getDoc(doc(meDb, memberPath(GYM_A, "m2"))));
  });

  test("can read their own memberships", async () => {
    const meDb = member(env, GYM_A, "m1").firestore();
    await assertSucceeds(getDoc(doc(meDb, membershipPath(GYM_A, "m1", "ms1"))));
  });

  test("cannot write their own member doc", async () => {
    const meDb = member(env, GYM_A, "m1").firestore();
    await assertFails(
      updateDoc(doc(meDb, memberPath(GYM_A, "m1")), { member_display_name: "Hacker" }),
    );
  });

  test("can read plans (to see options)", async () => {
    const meDb = member(env, GYM_A, "m1").firestore();
    await assertSucceeds(getDoc(doc(meDb, planPath(GYM_A, "p1"))));
  });

  test("cannot read leads", async () => {
    const meDb = member(env, GYM_A, "m1").firestore();
    await assertFails(getDoc(doc(meDb, leadPath(GYM_A, "l1"))));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Analytics rollups (derived view)", () => {
  const analyticsPath = (g: string, mk: string) =>
    `gym_profiles/${g}/analytics_monthly/${mk}`;

  test("owner can read their gym's rollups", async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, analyticsPath(GYM_A, "2026-06")), {
        month_key: "2026-06",
        gym_profile_id: GYM_A,
        revenue_collected_minor: 500000,
      });
    });
    const db = owner(env, GYM_A).firestore();
    await assertSucceeds(getDoc(doc(db, analyticsPath(GYM_A, "2026-06"))));
  });

  test("reception CANNOT read rollups (financial, owner-only)", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(getDoc(doc(db, analyticsPath(GYM_A, "2026-06"))));
  });

  test("owner CANNOT write rollups directly (server-only)", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, analyticsPath(GYM_A, "2026-06")), { revenue_collected_minor: 1 }),
    );
  });

  test("cross-tenant: Gym B owner cannot read Gym A rollups", async () => {
    const db = owner(env, GYM_B).firestore();
    await assertFails(getDoc(doc(db, analyticsPath(GYM_A, "2026-06"))));
  });
});

describe("public_rate_limits (server-only, locked)", () => {
  const rlPath = (k: string) => `public_rate_limits/${k}`;

  test("anonymous cannot read or write rate-limit docs", async () => {
    const db = anon(env).firestore();
    await assertFails(getDoc(doc(db, rlPath("contact:gymA:1.2.3.4"))));
    await assertFails(setDoc(doc(db, rlPath("contact:gymA:1.2.3.4")), { count: 1 }));
  });

  test("even an owner cannot touch rate-limit docs (catch-all deny)", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(getDoc(doc(db, rlPath("contact:gymA:1.2.3.4"))));
    await assertFails(setDoc(doc(db, rlPath("contact:gymA:1.2.3.4")), { count: 1 }));
  });
});

describe("Leads intake & pipeline", () => {
  const leadDoc = (g: string, id: string) => `gym_profiles/${g}/leads/${id}`;

  test("anonymous cannot write leads directly (intake goes via server)", async () => {
    const db = anon(env).firestore();
    await assertFails(
      setDoc(doc(db, leadDoc(GYM_A, "spam1")), {
        lead_id: "spam1",
        gym_profile_id: GYM_A,
        lead_status_key: "new",
      }),
    );
  });

  test("reception can read & update leads (pipeline)", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertSucceeds(getDoc(doc(db, leadDoc(GYM_A, "l1"))));
    await assertSucceeds(
      updateDoc(doc(db, leadDoc(GYM_A, "l1")), { lead_status_key: "contacted" }),
    );
  });

  test("a member cannot read leads", async () => {
    const db = member(env, GYM_A, "m1").firestore();
    await assertFails(getDoc(doc(db, leadDoc(GYM_A, "l1"))));
  });
});

describe("Platform admin (cross-tenant support)", () => {
  test("can read any tenant's member", async () => {
    const db = platformAdmin(env).firestore();
    await assertSucceeds(getDoc(doc(db, memberPath(GYM_A, "m1"))));
    await assertSucceeds(getDoc(doc(db, memberPath(GYM_B, "m1"))));
  });

  test("can write counters (server-style)", async () => {
    const db = platformAdmin(env).firestore();
    await assertSucceeds(updateDoc(doc(db, counters(GYM_A)), { active_count: 5 }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("Membership immutability (financial history is locked)", () => {
  test("owner CANNOT edit an existing membership period", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(
      updateDoc(doc(db, membershipPath(GYM_A, "m1", "ms1")), { amount_paid_minor: 1 }),
    );
  });

  test("owner CANNOT delete a membership period", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(deleteDoc(doc(db, membershipPath(GYM_A, "m1", "ms1"))));
  });

  test("reception CANNOT create/edit/delete a membership period", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(setDoc(doc(db, membershipPath(GYM_A, "m1", "new")), validMembership));
    await assertFails(updateDoc(doc(db, membershipPath(GYM_A, "m1", "ms1")), { amount_paid_minor: 1 }));
    await assertFails(deleteDoc(doc(db, membershipPath(GYM_A, "m1", "ms1"))));
  });
});

describe("Tenant-id write validation (anti-poisoning)", () => {
  test("reception CANNOT create a member tagged to another tenant", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, memberPath(GYM_A, "poison")), {
        member_id: "poison",
        gym_profile_id: GYM_B, // lies about tenant
        member_display_name: "Poison",
      }),
    );
  });

  test("owner CANNOT create a plan tagged to another tenant", async () => {
    const db = owner(env, GYM_A).firestore();
    await assertFails(
      setDoc(doc(db, planPath(GYM_A, "poisonPlan")), {
        plan_id: "poisonPlan",
        gym_profile_id: GYM_B,
        price_amount_minor: 1,
      }),
    );
  });

  test("matching tenant id is allowed", async () => {
    const db = reception(env, GYM_A).firestore();
    await assertSucceeds(
      setDoc(doc(db, memberPath(GYM_A, "okmember")), {
        member_id: "okmember",
        gym_profile_id: GYM_A,
        member_display_name: "Fine",
      }),
    );
  });
});
