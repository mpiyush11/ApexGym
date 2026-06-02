/**
 * Custom-claims contract (audit C2/C3).
 *
 * Every authenticated staff/owner user carries these claims on their Firebase
 * ID token so security rules + the app can resolve tenant + role WITHOUT an
 * extra Firestore read:
 *   - gym_profile_id  (which tenant)
 *   - role            (owner | reception | member | platform_admin)
 *   - member_id       (only for member-portal accounts; restricts to self)
 *
 * platform_admin is never granted to tenants.
 */
import type { RoleKey } from "@/lib/domain/constants";

export interface AppClaims {
  gym_profile_id?: string;
  role?: RoleKey;
  member_id?: string; // present only for member-portal users
}

/** Type-guard / normalizer for claims read off a decoded token. */
export function readClaims(raw: Record<string, unknown> | undefined): AppClaims {
  if (!raw) return {};
  const gym_profile_id =
    typeof raw.gym_profile_id === "string" ? raw.gym_profile_id : undefined;
  const role = typeof raw.role === "string" ? (raw.role as RoleKey) : undefined;
  const member_id =
    typeof raw.member_id === "string" ? raw.member_id : undefined;
  return { gym_profile_id, role, member_id };
}

export function isStaffRole(role: RoleKey | undefined): boolean {
  return role === "owner" || role === "reception";
}

export function isOwner(role: RoleKey | undefined): boolean {
  return role === "owner";
}
