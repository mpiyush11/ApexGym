/**
 * Staff management (server-only). Owner invites/deactivates RECEPTION users.
 * Reuses the existing app_users subcollection + custom claims contract — no new
 * collection. Owner-only at the API layer.
 *
 * V1 keeps this minimal: create a reception login (email + temp password) bound
 * to the gym via claims, list staff, deactivate (revoke claims + disable).
 */
import "server-only";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { ROLE_KEYS } from "@/lib/domain/constants";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";

export interface StaffView {
  app_user_id: string;
  app_user_email: string;
  app_user_display_name: string;
  app_user_role_key: string;
  is_active: boolean;
}

export async function listStaff(gym_profile_id: string): Promise<Result<StaffView[]>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const snap = await db
      .collection(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.APP_USERS}`)
      .get();
    return ok(
      snap.docs.map((d) => {
        const u = d.data();
        return {
          app_user_id: u.app_user_id,
          app_user_email: u.app_user_email ?? "",
          app_user_display_name: u.app_user_display_name ?? "",
          app_user_role_key: u.app_user_role_key ?? "reception",
          is_active: u.is_active !== false,
        };
      }),
    );
  } catch {
    return err("internal", "Could not load staff.");
  }
}

export interface InviteReceptionInput {
  email: string;
  display_name: string;
  temp_password: string;
}

export async function inviteReception(
  gym_profile_id: string,
  input: InviteReceptionInput,
): Promise<Result<{ app_user_id: string }>> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) return err("not_configured", "Auth/DB not configured.");

  let uid: string;
  try {
    // Reuse an existing account if the email already has one; else create.
    try {
      const existing = await auth.getUserByEmail(input.email);
      uid = existing.uid;
      const claims = (existing.customClaims ?? {}) as Record<string, unknown>;
      if (claims.gym_profile_id && claims.gym_profile_id !== gym_profile_id) {
        return err("conflict", "This email is already linked to another gym.");
      }
    } catch {
      const created = await auth.createUser({
        email: input.email,
        password: input.temp_password,
        displayName: input.display_name,
      });
      uid = created.uid;
    }

    // Bind reception claims to THIS gym.
    await auth.setCustomUserClaims(uid, {
      gym_profile_id,
      role: ROLE_KEYS.RECEPTION,
    });

    // Directory record.
    await db.doc(path.appUser(gym_profile_id, uid)).set({
      app_user_id: uid,
      gym_profile_id,
      app_user_email: input.email,
      app_user_display_name: input.display_name,
      app_user_role_key: ROLE_KEYS.RECEPTION,
      is_active: true,
      created_at: nowIso(),
    });

    return ok({ app_user_id: uid });
  } catch {
    return err("internal", "Could not create the reception login.");
  }
}

export async function setStaffActive(
  gym_profile_id: string,
  app_user_id: string,
  is_active: boolean,
): Promise<Result<true>> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) return err("not_configured", "Auth/DB not configured.");
  try {
    const ref = db.doc(path.appUser(gym_profile_id, app_user_id));
    const snap = await ref.get();
    if (!snap.exists) return err("not_found", "Staff member not found.");
    // Never let an owner deactivate an owner here (reception management only).
    if (snap.data()?.app_user_role_key === ROLE_KEYS.OWNER) {
      return err("forbidden", "Owner accounts cannot be changed here.");
    }

    if (is_active) {
      await auth.setCustomUserClaims(app_user_id, {
        gym_profile_id,
        role: ROLE_KEYS.RECEPTION,
      });
    } else {
      // Revoke tenant access by clearing claims + disabling the login.
      await auth.setCustomUserClaims(app_user_id, {});
      await auth.updateUser(app_user_id, { disabled: true }).catch(() => {});
      await auth.revokeRefreshTokens(app_user_id).catch(() => {});
    }
    await ref.set({ is_active }, { merge: true });
    return ok(true);
  } catch {
    return err("internal", "Could not update the staff member.");
  }
}
