/**
 * Member portal service (server-only). Binds a Firebase Auth user (verified by
 * phone OTP) to an EXISTING member record and resolves the digital-card bundle.
 *
 * Reuses the existing identity system (custom claims) and member data — no new
 * collections, indexes, or background jobs. Edge cases (explicitly required):
 *   1. Duplicate member_phone in the gym -> NEVER auto-select; fail + log.
 *   2. Existing member_auth_uid (different UID) -> NEVER silently rebind; fail + log.
 *   3. Suspended gym -> block login/portal/card with a consistent response.
 */
import "server-only";

import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { ROLE_KEYS } from "@/lib/domain/constants";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";
import { isGymSuspended } from "./gym.server";
import { writeActivityLog } from "./activityLog.server";
import type { Member } from "@/lib/domain/types";

/** Normalize a phone for matching: keep a leading +, strip other non-digits. */
function normalizePhone(raw: string): string {
  const trimmed = (raw ?? "").trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^0-9]/g, "");
}

export interface MemberBindResult {
  gym_profile_id: string;
  member_id: string;
}

/**
 * Resolve gym_slug -> gym_profile_id (reuses the slug index).
 */
async function resolveGymId(gym_slug: string): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  try {
    const idx = await db.doc(path.slugIndex(gym_slug)).get();
    const id = String(idx.data()?.gym_profile_id ?? "");
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Bind the signed-in Firebase user (uid) to a member in `gym_slug`, matched by
 * the user's VERIFIED phone. Sets custom claims + stamps member_auth_uid.
 */
export async function bindMemberLogin(
  gym_slug: string,
  uid: string,
  verifiedPhone: string | undefined,
): Promise<Result<MemberBindResult>> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) return err("not_configured", "Auth/DB not configured.");

  const phone = normalizePhone(verifiedPhone ?? "");
  if (!phone) return err("validation_failed", "A verified phone number is required.");

  const gym_profile_id = await resolveGymId(gym_slug);
  if (!gym_profile_id) return err("not_found", "Gym not found.");

  // Edge case 3: suspended gym blocks login.
  if (await isGymSuspended(gym_profile_id)) {
    return err("suspended", "This gym account is suspended. Please contact the gym.");
  }

  try {
    const col = db.collection(path.members(gym_profile_id));
    // Match by phone within THIS gym. Single-field equality uses Firestore's
    // automatic index (no composite index needed). Archived members are
    // filtered in memory — the per-phone result set is tiny.
    const snap = await col.where("member_phone", "==", phone).limit(5).get();
    const matches = snap.docs.filter((d) => (d.data() as Member).is_archived !== true);

    if (matches.length === 0) {
      return err("not_found", "No membership found for this phone number. Please contact the gym.");
    }

    // Edge case 1: duplicate phone in the same gym — DO NOT auto-select.
    if (matches.length > 1) {
      await writeActivityLog({
        gym_profile_id,
        actor_app_user_id: uid,
        actor_display_name: phone,
        action_key: "member.login_ambiguous",
        entity_type: "member",
        entity_id: phone,
        summary: `Member login blocked: ${matches.length} members share phone ${phone}`,
      });
      return err(
        "conflict",
        "Multiple memberships use this phone number. Please contact the gym to sign in.",
      );
    }

    const doc = matches[0];
    const member = doc.data() as Member;

    // Edge case 2: already bound to a DIFFERENT Firebase UID — never rebind.
    if (member.member_auth_uid && member.member_auth_uid !== uid) {
      await writeActivityLog({
        gym_profile_id,
        actor_app_user_id: uid,
        actor_display_name: phone,
        action_key: "member.login_rebind_blocked",
        entity_type: "member",
        entity_id: member.member_id,
        summary: `Member login blocked: ${member.member_code} already linked to another login`,
      });
      return err(
        "conflict",
        "This membership is already linked to a different login. Please contact the gym.",
      );
    }

    // Bind: set claims + stamp member_auth_uid (idempotent if same uid).
    await auth.setCustomUserClaims(uid, {
      gym_profile_id,
      role: ROLE_KEYS.MEMBER,
      member_id: member.member_id,
    });

    if (!member.member_auth_uid) {
      await doc.ref.set(
        { member_auth_uid: uid, updated_at: nowIso() },
        { merge: true },
      );
      await writeActivityLog({
        gym_profile_id,
        actor_app_user_id: uid,
        actor_display_name: member.member_display_name,
        action_key: "member.login_bind",
        entity_type: "member",
        entity_id: member.member_id,
        summary: `Member portal linked for ${member.member_code}`,
      });
    }

    return ok({ gym_profile_id, member_id: member.member_id });
  } catch {
    return err("internal", "Could not sign you in. Please try again.");
  }
}

export interface MemberCardBundle {
  member_display_name: string;
  member_code: string;
  member_photo_url: string;
  member_phone: string;
  member_join_date: string;
  member_status_key: string;
  member_tier_key: string;
  plan_name_snapshot: string | null;
  membership_end_date: string | null;
  amount_due_minor: number;
  currency_code: string;
  gym_display_name: string;
  gym_primary_color_hex: string;
  gym_whatsapp_number: string;
  gym_slug: string;
}

/**
 * Resolve the digital-card bundle for the signed-in member. Pure read of
 * existing records (member doc holds the denormalized membership summary) +
 * gym branding. Edge case 3: suspended gym blocks the card.
 */
export async function getMemberCard(
  gym_profile_id: string,
  member_id: string,
): Promise<Result<MemberCardBundle>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");

  if (await isGymSuspended(gym_profile_id)) {
    return err("suspended", "This gym account is suspended. Please contact the gym.");
  }

  try {
    const [memberSnap, gymSnap] = await Promise.all([
      db.doc(`${path.members(gym_profile_id)}/${member_id}`).get(),
      db.doc(path.gymProfile(gym_profile_id)).get(),
    ]);
    if (!memberSnap.exists) return err("not_found", "Member not found.");
    const m = memberSnap.data() as Member;
    if (m.is_archived) return err("not_found", "This membership is no longer active.");
    const g = gymSnap.data() ?? {};
    const summary = m.current_membership_summary ?? null;

    return ok({
      member_display_name: m.member_display_name,
      member_code: m.member_code,
      member_photo_url: m.member_photo_url ?? "",
      member_phone: m.member_phone,
      member_join_date: m.member_join_date,
      member_status_key: m.member_status_key,
      member_tier_key: m.member_tier_key ?? "standard",
      plan_name_snapshot: summary?.plan_name_snapshot ?? null,
      membership_end_date: summary?.membership_end_date ?? null,
      amount_due_minor: summary?.amount_due_minor ?? 0,
      currency_code: g.default_currency_code ?? "INR",
      gym_display_name: g.gym_display_name ?? "",
      gym_primary_color_hex: g.gym_primary_color_hex ?? "#d4af37",
      gym_whatsapp_number: g.gym_whatsapp_number ?? "",
      gym_slug: g.gym_slug ?? "",
    });
  } catch {
    return err("internal", "Could not load your card.");
  }
}

export { SUBCOLLECTIONS };
