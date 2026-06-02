/**
 * API authorization guard (server-only).
 *
 * Resolves the session and asserts role permissions for tenant-scoped API
 * routes. Returns a discriminated result so handlers stay thin and never throw.
 *
 * Mirrors the Firestore Security Rules (M2) so the service layer and the DB
 * layer agree on who can do what (defense in depth).
 */
import "server-only";

import { getSessionUser, type SessionUser } from "./session.server";
import { isStaffRole } from "./claims";
import { isGymSuspended } from "@/lib/services/gym.server";
import type { RoleKey } from "@/lib/domain/constants";

export type GuardOk = {
  ok: true;
  user: SessionUser;
  gym_profile_id: string;
  role: RoleKey;
};
export type GuardErr = {
  ok: false;
  code: "unauthenticated" | "forbidden" | "suspended";
  message: string;
};
export type GuardResult = GuardOk | GuardErr;

/** Require a signed-in staff member (owner or reception) bound to a tenant. */
export async function requireStaff(): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Please sign in." };
  const { gym_profile_id, role } = user.claims;
  if (!gym_profile_id || !role) {
    return { ok: false, code: "forbidden", message: "No gym is linked to this account." };
  }
  if (!isStaffRole(role)) {
    return { ok: false, code: "forbidden", message: "Staff access required." };
  }
  // Billing/account enforcement: a suspended gym is locked out (cached check).
  if (await isGymSuspended(gym_profile_id)) {
    return {
      ok: false,
      code: "suspended",
      message: "This gym account is suspended. Please contact support.",
    };
  }
  return { ok: true, user, gym_profile_id, role };
}

/** Require the OWNER role specifically (e.g. plan pricing, settings). */
export async function requireOwner(): Promise<GuardResult> {
  const res = await requireStaff();
  if (!res.ok) return res;
  if (res.role !== "owner") {
    return { ok: false, code: "forbidden", message: "Owner access required." };
  }
  return res;
}

export type MemberGuardOk = {
  ok: true;
  user: SessionUser;
  gym_profile_id: string;
  member_id: string;
};
export type MemberGuardResult = MemberGuardOk | GuardErr;

/**
 * Require a signed-in MEMBER bound to a tenant + member_id (portal/card).
 * Suspension is enforced inside the portal services (consistent response).
 */
export async function requireMember(): Promise<MemberGuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "unauthenticated", message: "Please sign in." };
  const { gym_profile_id, role, member_id } = user.claims;
  if (role !== "member" || !gym_profile_id || !member_id) {
    return { ok: false, code: "forbidden", message: "Member access required." };
  }
  return { ok: true, user, gym_profile_id, member_id };
}
