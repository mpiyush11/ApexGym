/**
 * Lead service (server-only). Tenant-scoped by gym_profile_id.
 *
 *  - resolveGymBySlug: public slug -> gym_profile_id (1 read on the existing
 *    gym_slug_index). Returns null if not found/unpublished.
 *  - createPublicLead: transactional create of a lead + bump counters.lead_new_count.
 *    Source = public_contact_form. Spam-trap fields are validated by the caller
 *    and never persisted.
 *  - listLeads: bounded pipeline query (limit 30), optional status filter (uses
 *    the existing composite index leads(status, created_at desc)).
 *  - setLeadStatus: transactional status change; adjusts lead_new_count only when
 *    leaving/entering the "new" bucket (keeps the dashboard counter correct).
 *
 * No separate CRM, no lead analytics rollup (constraint #1/#2/#6).
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { path, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { LEAD_SOURCE_KEYS, LEAD_STATUS_KEYS, type LeadStatusKey } from "@/lib/domain/constants";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";
import type { Lead } from "@/lib/domain/types";
import type { PublicContactInput } from "./lead.schema";

const PAGE_LIMIT = 30;

export interface ResolvedGym {
  gym_profile_id: string;
  gym_display_name: string;
  public_site_is_published: boolean;
  is_suspended: boolean;
}

/** Resolve a public gym_slug to its tenant (for the public contact form). */
export async function resolveGymBySlug(
  gym_slug: string,
): Promise<Result<ResolvedGym>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const idxSnap = await db.doc(path.slugIndex(gym_slug)).get();
    if (!idxSnap.exists) return err("not_found", "Gym not found.");
    const gym_profile_id = String(idxSnap.data()?.gym_profile_id ?? "");
    if (!gym_profile_id) return err("not_found", "Gym not found.");
    const gymSnap = await db.doc(path.gymProfile(gym_profile_id)).get();
    const g = gymSnap.data() ?? {};
    return ok({
      gym_profile_id,
      gym_display_name: g.gym_display_name || "this gym",
      public_site_is_published: Boolean(g.public_site_is_published),
      is_suspended: g.gym_status_key === "suspended",
    });
  } catch {
    return err("internal", "Could not resolve the gym.");
  }
}

export async function createPublicLead(
  gym_profile_id: string,
  input: PublicContactInput,
): Promise<Result<{ lead_id: string }>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");

  const leadRef = db.collection(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.LEADS}`).doc();
  const countersRef = db.doc(path.counters(gym_profile_id));
  const now = nowIso();

  const lead: Lead = {
    lead_id: leadRef.id,
    gym_profile_id,
    lead_display_name: input.lead_display_name,
    lead_phone: input.lead_phone || "",
    lead_email: input.lead_email || "",
    lead_message: input.lead_message || "",
    lead_source_key: LEAD_SOURCE_KEYS.PUBLIC_CONTACT_FORM,
    lead_status_key: LEAD_STATUS_KEYS.NEW,
    assigned_app_user_id: null,
    converted_member_id: null,
    created_at: now,
    updated_at: now,
  };

  try {
    await db.runTransaction(async (tx) => {
      tx.set(leadRef, lead);
      tx.set(
        countersRef,
        { lead_new_count: FieldValue.increment(1), updated_at: now },
        { merge: true },
      );
    });
    return ok({ lead_id: leadRef.id });
  } catch {
    return err("internal", "Could not submit your enquiry. Please try again.");
  }
}

export async function listLeads(
  gym_profile_id: string,
  statusFilter?: LeadStatusKey | null,
): Promise<Result<Lead[]>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const col = db.collection(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.LEADS}`);
    let q = col.orderBy("created_at", "desc").limit(PAGE_LIMIT);
    if (statusFilter) {
      q = col
        .where("lead_status_key", "==", statusFilter)
        .orderBy("created_at", "desc")
        .limit(PAGE_LIMIT);
    }
    const snap = await q.get();
    return ok(snap.docs.map((d) => d.data() as Lead));
  } catch {
    return err("internal", "Could not load leads.");
  }
}

export async function setLeadStatus(
  gym_profile_id: string,
  lead_id: string,
  next: LeadStatusKey,
): Promise<Result<Lead>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  const leadRef = db.doc(`${path.gymProfile(gym_profile_id)}/${SUBCOLLECTIONS.LEADS}/${lead_id}`);
  const countersRef = db.doc(path.counters(gym_profile_id));
  const now = nowIso();
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(leadRef);
      if (!snap.exists) throw new Error("not_found");
      const prev = snap.data() as Lead;

      // Keep lead_new_count accurate: it counts leads still in "new".
      const wasNew = prev.lead_status_key === LEAD_STATUS_KEYS.NEW;
      const willBeNew = next === LEAD_STATUS_KEYS.NEW;
      if (wasNew !== willBeNew) {
        tx.set(
          countersRef,
          { lead_new_count: FieldValue.increment(willBeNew ? 1 : -1), updated_at: now },
          { merge: true },
        );
      }

      tx.set(leadRef, { lead_status_key: next, updated_at: now }, { merge: true });
      return { ...prev, lead_status_key: next, updated_at: now };
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "not_found") {
      return err("not_found", "Lead not found.");
    }
    return err("internal", "Could not update the lead.");
  }
}

export { COLLECTIONS };
