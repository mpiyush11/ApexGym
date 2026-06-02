/**
 * Activity log writer (server-only). Lightweight audit trail for accountability
 * across multiple staff + cash handling (audit 1.8 / 4.2). Owner-readable,
 * server-write-only (rules-enforced). Kept intentionally small — NOT a CRM/event
 * bus. Can be written standalone or inside an existing transaction.
 */
import "server-only";

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";

export interface ActivityLogInput {
  gym_profile_id: string;
  actor_app_user_id: string;
  actor_display_name: string;
  action_key: string; // e.g. "member.create"
  entity_type: string; // e.g. "member"
  entity_id: string;
  summary: string;
}

function buildDoc(db: Firestore, input: ActivityLogInput) {
  const ref = db
    .collection(`${path.gymProfile(input.gym_profile_id)}/${SUBCOLLECTIONS.ACTIVITY_LOGS}`)
    .doc();
  return {
    ref,
    data: { log_id: ref.id, ...input, created_at: nowIso() },
  };
}

/** Add a log write to an EXISTING transaction (atomic with the change). */
export function appendActivityLogTx(
  db: Firestore,
  tx: Transaction,
  input: ActivityLogInput,
): void {
  const { ref, data } = buildDoc(db, input);
  tx.set(ref, data);
}

/** Fire-and-forget standalone log (never throws; best-effort audit). */
export async function writeActivityLog(input: ActivityLogInput): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  try {
    const { ref, data } = buildDoc(db, input);
    await ref.set(data);
  } catch {
    // Audit logging must never break the primary operation.
  }
}
