/**
 * Lead intake + pipeline INTEGRATION test against the Firestore emulator.
 * Proves:
 *   - public lead create bumps counters.lead_new_count (dashboard metric)
 *   - moving a lead OUT of "new" decrements the counter
 *   - moving back INTO "new" increments again
 * Mirrors the transactional logic in lead.service.ts (Admin writes bypass rules).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const PROJECT = "gymos-rules-test";
const GYM = "gymLeads";

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, "lead-it");
  db = getFirestore(app);
});
afterAll(async () => {
  if (app) await deleteApp(app);
});

const profilePath = `gym_profiles/${GYM}`;
const leadsPath = `${profilePath}/leads`;
const countersPath = `${profilePath}/counters/summary`;

beforeEach(async () => {
  await db.recursiveDelete(db.doc(profilePath));
  await db.doc(profilePath).set({ gym_profile_id: GYM, gym_display_name: "Leads Gym" });
  await db.doc(countersPath).set({ gym_profile_id: GYM, lead_new_count: 0 });
});

async function createPublicLead() {
  const ref = db.collection(leadsPath).doc();
  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      lead_id: ref.id,
      gym_profile_id: GYM,
      lead_display_name: "Visitor",
      lead_phone: "+910000000000",
      lead_source_key: "public_contact_form",
      lead_status_key: "new",
      created_at: new Date().toISOString(),
    });
    tx.set(db.doc(countersPath), { lead_new_count: FieldValue.increment(1) }, { merge: true });
  });
  return ref.id;
}

async function setStatus(leadId: string, next: string) {
  const ref = db.doc(`${leadsPath}/${leadId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.data()!;
    const wasNew = prev.lead_status_key === "new";
    const willBeNew = next === "new";
    if (wasNew !== willBeNew) {
      tx.set(
        db.doc(countersPath),
        { lead_new_count: FieldValue.increment(willBeNew ? 1 : -1) },
        { merge: true },
      );
    }
    tx.set(ref, { lead_status_key: next }, { merge: true });
  });
}

async function newCount(): Promise<number> {
  const snap = await db.doc(countersPath).get();
  return Number(snap.data()?.lead_new_count) || 0;
}

describe("Lead intake & counter accuracy", () => {
  test("public create increments lead_new_count", async () => {
    await createPublicLead();
    await createPublicLead();
    expect(await newCount()).toBe(2);
  });

  test("moving a lead out of 'new' decrements the counter", async () => {
    const id = await createPublicLead();
    expect(await newCount()).toBe(1);
    await setStatus(id, "contacted");
    expect(await newCount()).toBe(0);
  });

  test("counter does not change between two non-new statuses", async () => {
    const id = await createPublicLead();
    await setStatus(id, "contacted");
    await setStatus(id, "converted");
    expect(await newCount()).toBe(0);
  });

  test("moving back to 'new' increments again", async () => {
    const id = await createPublicLead();
    await setStatus(id, "lost");
    expect(await newCount()).toBe(0);
    await setStatus(id, "new");
    expect(await newCount()).toBe(1);
  });
});
