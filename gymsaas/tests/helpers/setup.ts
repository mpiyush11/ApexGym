/**
 * Shared test harness for Firestore Security Rules unit tests.
 *
 * Boots a RulesTestEnvironment against the Firestore emulator and provides
 * authenticated contexts for each role/tenant with the EXACT custom claims
 * our app sets (gym_profile_id, role, member_id).
 */
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PROJECT_ID = "gymos-rules-test";

// Two tenants to prove cross-tenant isolation.
export const GYM_A = "gymA";
export const GYM_B = "gymB";

let testEnv: RulesTestEnvironment | null = null;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (testEnv) return testEnv;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  return testEnv;
}

// ── Authenticated contexts with our real claim shape ───────────────────────
type Ctx = ReturnType<RulesTestEnvironment["authenticatedContext"]>;

export function owner(env: RulesTestEnvironment, gym: string, uid = `${gym}-owner`): Ctx {
  return env.authenticatedContext(uid, { gym_profile_id: gym, role: "owner" });
}

export function reception(env: RulesTestEnvironment, gym: string, uid = `${gym}-reception`): Ctx {
  return env.authenticatedContext(uid, { gym_profile_id: gym, role: "reception" });
}

export function member(
  env: RulesTestEnvironment,
  gym: string,
  memberId: string,
  uid = `${gym}-member-${memberId}`,
): Ctx {
  return env.authenticatedContext(uid, {
    gym_profile_id: gym,
    role: "member",
    member_id: memberId,
  });
}

export function platformAdmin(env: RulesTestEnvironment, uid = "platform-admin"): Ctx {
  return env.authenticatedContext(uid, { role: "platform_admin" });
}

export function anon(env: RulesTestEnvironment) {
  return env.unauthenticatedContext();
}

/** Seed data bypassing rules (admin context) before each test. */
export async function seed(
  env: RulesTestEnvironment,
  fn: (db: import("firebase/firestore").Firestore) => Promise<void>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    // firestore() returns a client SDK instance with rules disabled.
    await fn(ctx.firestore() as unknown as import("firebase/firestore").Firestore);
  });
}
