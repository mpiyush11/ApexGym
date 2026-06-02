/**
 * Member service (server-only). Tenant-scoped by gym_profile_id.
 *
 *  - create: transactional. Allocates a unique member_code (bumps counters),
 *    bumps total_members, writes the member, and warns on duplicate phone.
 *  - list/search: cursor pagination (audit 9.2). Search by name/phone/code.
 *  - update: partial edit.
 *  - archive: soft delete (audit 6.6) — never destroy member/payment history.
 *
 * Status (member_status_key) is DERIVED and maintained on renewal / daily cron
 * (M4). New members start as "inactive" until their first membership.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { path } from "@/lib/firebase/paths";
import {
  CURRENT_SCHEMA_VERSION,
  MEMBER_STATUS_KEYS,
} from "@/lib/domain/constants";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";
import type { Member } from "@/lib/domain/types";
import { allocateMemberCodeTx, gymShortCode } from "./memberCode.server";
import { appendActivityLogTx, writeActivityLog } from "./activityLog.server";
import type { MemberCreateInput, MemberUpdateInput } from "./member.schema";

/** Who performed the action (for the audit trail). */
export interface Actor {
  app_user_id: string;
  display_name: string;
}

const PAGE_SIZE = 20;

function membersCol(gym_profile_id: string) {
  const db = getAdminDb();
  return db ? db.collection(path.members(gym_profile_id)) : null;
}

export interface CreateMemberResult {
  member: Member;
  duplicate_warning: boolean;
}

export async function createMember(
  gym_profile_id: string,
  gym_display_name: string,
  actor: Actor,
  input: MemberCreateInput,
): Promise<Result<CreateMemberResult>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  const col = db.collection(path.members(gym_profile_id));

  // Duplicate-phone check (audit 12.3) — warn, don't block (twins/shared phones).
  let duplicate_warning = false;
  try {
    const dup = await col.where("member_phone", "==", input.member_phone).limit(1).get();
    duplicate_warning = !dup.empty;
  } catch {
    // non-fatal: proceed without the warning
  }

  const ref = col.doc();
  const now = nowIso();
  const short = gymShortCode(gym_display_name);

  try {
    const member = await db.runTransaction(async (tx) => {
      const { member_code } = await allocateMemberCodeTx(db, tx, gym_profile_id, short);
      const countersRef = db.doc(path.counters(gym_profile_id));

      const newMember: Member = {
        member_id: ref.id,
        gym_profile_id,
        member_code,
        member_display_name: input.member_display_name,
        member_phone: input.member_phone,
        member_email: input.member_email || "",
        member_photo_url: input.member_photo_url || "",
        member_join_date: now,
        member_tier_key: input.member_tier_key,
        assigned_trainer_id: null,
        member_status_key: MEMBER_STATUS_KEYS.INACTIVE, // until first membership
        current_membership_summary: null,
        source_lead_id: null,
        member_notes: input.member_notes || "",
        member_auth_uid: null,
        is_archived: false,
        schema_version: CURRENT_SCHEMA_VERSION,
        created_at: now,
        updated_at: now,
      };

      tx.set(ref, newMember);
      // Bump total_members counter (counter writes are server-only per rules).
      tx.set(
        countersRef,
        { total_members: FieldValue.increment(1), updated_at: now },
        { merge: true },
      );
      // Audit trail (atomic with the create).
      appendActivityLogTx(db, tx, {
        gym_profile_id,
        actor_app_user_id: actor.app_user_id,
        actor_display_name: actor.display_name,
        action_key: "member.create",
        entity_type: "member",
        entity_id: ref.id,
        summary: `Added member ${newMember.member_display_name} (${member_code})`,
      });
      return newMember;
    });
    return ok({ member, duplicate_warning });
  } catch {
    return err("internal", "Could not create the member. Please try again.");
  }
}

export interface MemberPage {
  members: Member[];
  next_cursor: string | null;
}

export async function listMembers(
  gym_profile_id: string,
  opts: { cursor?: string | null } = {},
): Promise<Result<MemberPage>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    let q = col
      .where("is_archived", "==", false)
      .orderBy("created_at", "desc")
      .limit(PAGE_SIZE + 1);
    if (opts.cursor) {
      const curSnap = await col.doc(opts.cursor).get();
      if (curSnap.exists) q = q.startAfter(curSnap);
    }
    const snap = await q.get();
    const docs = snap.docs.slice(0, PAGE_SIZE);
    const members = docs.map((d) => d.data() as Member);
    const next_cursor =
      snap.docs.length > PAGE_SIZE ? docs[docs.length - 1]?.id ?? null : null;
    return ok({ members, next_cursor });
  } catch {
    return err("internal", "Could not load members.");
  }
}

/**
 * Search by name/phone/member_code. Firestore has no full-text search, so we
 * do prefix matching on a normalized field set. For V1 small gyms this is fine;
 * a search index can be added later if needed.
 */
export async function searchMembers(
  gym_profile_id: string,
  rawTerm: string,
): Promise<Result<Member[]>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  const term = rawTerm.trim();
  if (!term) return ok([]);
  try {
    // Phone/code: prefix range query. Name: case-insensitive client filter on a
    // bounded recent set (keeps it simple + cheap for V1 gym sizes).
    const isNumeric = /^[+0-9]+$/.test(term);
    if (isNumeric) {
      const end = term + "\uf8ff";
      const snap = await col
        .where("member_phone", ">=", term)
        .where("member_phone", "<=", end)
        .limit(20)
        .get();
      return ok(snap.docs.map((d) => d.data() as Member));
    }
    // Name/code search: fetch a bounded recent window and filter in memory.
    const snap = await col
      .where("is_archived", "==", false)
      .orderBy("created_at", "desc")
      .limit(200)
      .get();
    const lower = term.toLowerCase();
    const matches = snap.docs
      .map((d) => d.data() as Member)
      .filter(
        (m) =>
          m.member_display_name?.toLowerCase().includes(lower) ||
          m.member_code?.toLowerCase().includes(lower),
      )
      .slice(0, 20);
    return ok(matches);
  } catch {
    return err("internal", "Search failed.");
  }
}

export async function getMember(
  gym_profile_id: string,
  member_id: string,
): Promise<Result<Member>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    const snap = await col.doc(member_id).get();
    if (!snap.exists) return err("not_found", "Member not found.");
    return ok(snap.data() as Member);
  } catch {
    return err("internal", "Could not load the member.");
  }
}

export async function updateMember(
  gym_profile_id: string,
  member_id: string,
  input: MemberUpdateInput,
  actor: Actor,
): Promise<Result<Member>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  const ref = col.doc(member_id);
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  try {
    const snap = await ref.get();
    if (!snap.exists) return err("not_found", "Member not found.");
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    const m = updated.data() as Member;
    await writeActivityLog({
      gym_profile_id,
      actor_app_user_id: actor.app_user_id,
      actor_display_name: actor.display_name,
      action_key: "member.edit",
      entity_type: "member",
      entity_id: member_id,
      summary: `Edited member ${m.member_display_name} (${m.member_code})`,
    });
    return ok(m);
  } catch {
    return err("internal", "Could not update the member.");
  }
}

/** Soft delete (archive). Owner-only at the API layer. */
export async function archiveMember(
  gym_profile_id: string,
  member_id: string,
  actor: Actor,
): Promise<Result<true>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    const snap = await col.doc(member_id).get();
    const m = snap.exists ? (snap.data() as Member) : null;
    await col.doc(member_id).set(
      { is_archived: true, updated_at: nowIso() },
      { merge: true },
    );
    await writeActivityLog({
      gym_profile_id,
      actor_app_user_id: actor.app_user_id,
      actor_display_name: actor.display_name,
      action_key: "member.archive",
      entity_type: "member",
      entity_id: member_id,
      summary: `Archived member ${m?.member_display_name ?? member_id}`,
    });
    return ok(true);
  } catch {
    return err("internal", "Could not archive the member.");
  }
}

/**
 * Expiring worklist for the dashboard/renewals tab. Returns expiring_soon +
 * expired members ordered by expiry date (soonest first). Uses the composite
 * index declared in firestore.indexes.json.
 */
export async function listExpiringMembers(
  gym_profile_id: string,
  limit = 50,
): Promise<Result<Member[]>> {
  const col = membersCol(gym_profile_id);
  if (!col) return err("not_configured", "Database not configured.");
  try {
    const statuses = ["expiring_soon", "expired"];
    const snap = await col
      .where("is_archived", "==", false)
      .where("member_status_key", "in", statuses)
      .limit(limit)
      .get();
    const members = snap.docs
      .map((d) => d.data() as Member)
      .sort((a, b) => {
        const ax = a.current_membership_summary?.membership_end_date ?? "";
        const bx = b.current_membership_summary?.membership_end_date ?? "";
        return ax.localeCompare(bx);
      });
    return ok(members);
  } catch {
    return err("internal", "Could not load expiring members.");
  }
}
