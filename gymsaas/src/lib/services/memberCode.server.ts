/**
 * Member code generation (server-only, transactional).
 *
 * member_code is unique per gym and human-readable: {SHORT}-{YYYY}-{000123}.
 * The sequence lives on the per-gym counters doc (member_seq). We bump it
 * inside a Firestore transaction to prevent duplicate codes under concurrent
 * reception writes (audit 6.3). Caller passes the transaction so this can be
 * composed with the member create in ONE atomic operation.
 */
import "server-only";

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { path } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";

/** Derive a short uppercase prefix from the gym display name. */
export function gymShortCode(gym_display_name: string): string {
  const letters = (gym_display_name.match(/[A-Za-z]/g) ?? []).join("");
  const base = (letters || "GYM").toUpperCase();
  return base.slice(0, 4).padEnd(3, "X");
}

function pad(n: number): string {
  return String(n).padStart(6, "0");
}

/**
 * Reserve the next member_code within an existing transaction.
 * Reads + bumps counters.member_seq atomically.
 */
export async function allocateMemberCodeTx(
  db: Firestore,
  tx: Transaction,
  gym_profile_id: string,
  gymShort: string,
): Promise<{ member_code: string; next_seq: number }> {
  const countersRef = db.doc(path.counters(gym_profile_id));
  const snap = await tx.get(countersRef);
  const current = snap.exists ? (snap.data()?.member_seq ?? 0) : 0;
  const next_seq = Number(current) + 1;
  const year = new Date().getUTCFullYear();
  const member_code = `${gymShort}-${year}-${pad(next_seq)}`;
  // Persist the new sequence (counter writes are server-only per rules).
  tx.set(
    countersRef,
    { member_seq: next_seq, updated_at: nowIso() },
    { merge: true },
  );
  return { member_code, next_seq };
}
