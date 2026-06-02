/**
 * Tenant onboarding service (server-only, env-safe).
 *
 * Creates a new gym tenant for the currently-authenticated user and promotes
 * them to OWNER. All writes are atomic (Firestore transaction) and gym_slug
 * uniqueness is guaranteed via a top-level index doc (audit 5.4).
 *
 * Steps (single transaction):
 *   1. Reserve gym_slug_index/{gym_slug}  -> fails if taken (conflict)
 *   2. Create gym_profiles/{gym_profile_id}
 *   3. Create settings + counters singletons
 *   4. Create app_users/{uid} as owner
 * Then (post-commit): set custom claims { gym_profile_id, role: owner }.
 */
import "server-only";

import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { COLLECTIONS, SINGLETON_IDS, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import {
  CURRENT_SCHEMA_VERSION,
  GYM_STATUS_KEYS,
  ROLE_KEYS,
} from "@/lib/domain/constants";
import { nowIso, monthKey } from "@/lib/utils/time";
import { slugify, isValidGymSlug } from "@/lib/utils/slug";
import { ok, err, type Result } from "@/lib/utils/result";
import type { OnboardingInput } from "./onboarding.schema";

export interface OnboardingResult {
  gym_profile_id: string;
  gym_slug: string;
  role: typeof ROLE_KEYS.OWNER;
}

export async function createTenantForUser(
  uid: string,
  email: string | undefined,
  input: OnboardingInput,
): Promise<Result<OnboardingResult>> {
  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) {
    return err("not_configured", "Firebase Admin is not configured on the server.");
  }

  // Prevent a user from owning two gyms in V1 (one gym per user).
  try {
    const existing = await auth.getUser(uid);
    const existingClaims = (existing.customClaims ?? {}) as Record<string, unknown>;
    if (existingClaims.gym_profile_id) {
      return err("conflict", "This account is already linked to a gym.");
    }
  } catch {
    // If we cannot read the user, fail safe.
    return err("internal", "Unable to verify the current account.");
  }

  const desiredSlug = slugify(input.gym_slug || input.gym_display_name);
  if (!isValidGymSlug(desiredSlug)) {
    return err(
      "validation_failed",
      "Could not derive a valid gym URL. Please choose a different name or slug.",
    );
  }

  const now = nowIso();
  const gymProfileRef = db.collection(COLLECTIONS.GYM_PROFILES).doc();
  const gym_profile_id = gymProfileRef.id;
  const slugRef = db.collection(COLLECTIONS.GYM_SLUG_INDEX).doc(desiredSlug);

  try {
    await db.runTransaction(async (tx) => {
      // 1. Slug uniqueness (global).
      const slugSnap = await tx.get(slugRef);
      if (slugSnap.exists) {
        throw new SlugTakenError();
      }

      // 2. gym_profile
      tx.set(gymProfileRef, {
        gym_profile_id,
        gym_slug: desiredSlug,
        gym_display_name: input.gym_display_name,
        gym_contact_phone: input.gym_contact_phone || "",
        gym_whatsapp_number: input.gym_whatsapp_number || "",
        gym_city: input.gym_city || "",
        gym_contact_email: email || "",
        default_currency_code: input.default_currency_code || "INR",
        gym_timezone: input.gym_timezone || "Asia/Kolkata",
        attendance_enabled: false, // optional module OFF by default
        public_site_is_published: false,
        gym_status_key: GYM_STATUS_KEYS.ACTIVE,
        schema_version: CURRENT_SCHEMA_VERSION,
        created_at: now,
        updated_at: now,
      });

      // 1b. slug index points back to the gym
      tx.set(slugRef, { gym_profile_id, created_at: now });

      // 3a. settings singleton
      tx.set(
        gymProfileRef
          .collection(SUBCOLLECTIONS.SETTINGS)
          .doc(SINGLETON_IDS.SETTINGS),
        {
          gym_profile_id,
          renewal_reminder_days_before: 7,
          report_recipient_emails: email ? [email] : [],
          whatsapp_default_message_template:
            "Hi {member_display_name}, your membership at {gym_display_name} expires on {membership_end_date}. Renew today!",
        },
      );

      // 3b. counters singleton
      tx.set(
        gymProfileRef
          .collection(SUBCOLLECTIONS.COUNTERS)
          .doc(SINGLETON_IDS.COUNTERS),
        {
          gym_profile_id,
          member_seq: 0,
          active_count: 0,
          expiring_count: 0,
          expired_count: 0,
          total_members: 0,
          lead_new_count: 0,
          revenue_month_minor: 0,
          revenue_month_key: monthKey(now),
          updated_at: now,
        },
      );

      // 4. owner app_user
      tx.set(gymProfileRef.collection(SUBCOLLECTIONS.APP_USERS).doc(uid), {
        app_user_id: uid,
        gym_profile_id,
        app_user_email: email || "",
        app_user_display_name: input.owner_display_name,
        app_user_role_key: ROLE_KEYS.OWNER,
        is_active: true,
        last_login_at: now,
      });
    });
  } catch (e) {
    if (e instanceof SlugTakenError) {
      return err("conflict", `The gym URL "${desiredSlug}" is already taken.`);
    }
    return err("internal", "Failed to create the gym. Please try again.");
  }

  // Post-commit: set custom claims so the token carries tenant + role.
  try {
    await auth.setCustomUserClaims(uid, {
      gym_profile_id,
      role: ROLE_KEYS.OWNER,
    });
  } catch {
    // The tenant exists but claims failed — recoverable via /api/auth/claims refresh.
    return err(
      "internal",
      "Gym created, but assigning your role failed. Please re-login to retry.",
    );
  }

  return ok({ gym_profile_id, gym_slug: desiredSlug, role: ROLE_KEYS.OWNER });
}

class SlugTakenError extends Error {}
