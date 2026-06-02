/**
 * Daily status recompute (server-only) — invoked by a scheduled job (cron).
 *
 * Firestore has no native cron, so this is exposed via an authenticated route
 * (M9 wires the scheduler). It walks members, recomputes member_status_key from
 * their current_membership_summary.membership_end_date, persists changes, and
 * rebuilds the active/expiring/expired counters so the dashboard stays correct
 * even when no renewals happen (e.g. active -> expired transitions).
 *
 * Env-safe + bounded: processes in batches; never throws.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path } from "@/lib/firebase/paths";
import { MEMBER_STATUS_KEYS, type MemberStatusKey } from "@/lib/domain/constants";
import { nowIso } from "@/lib/utils/time";
import { gymTodayIso } from "@/lib/domain/renewal.logic";
import { deriveMemberStatus } from "@/lib/domain/status.logic";
import { ok, err, type Result } from "@/lib/utils/result";
import { getGymBasics } from "./gym.server";
import type { Member } from "@/lib/domain/types";

export interface RecomputeSummary {
  scanned: number;
  changed: number;
  active_count: number;
  expiring_count: number;
  expired_count: number;
}

export async function recomputeGymStatuses(
  gym_profile_id: string,
  reminder_days = 7,
): Promise<Result<RecomputeSummary>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");

  const { gym_timezone } = await getGymBasics(gym_profile_id);
  const todayIso = gymTodayIso(gym_timezone);

  try {
    const col = db.collection(path.members(gym_profile_id));
    const snap = await col.where("is_archived", "==", false).get();

    let changed = 0;
    let active = 0;
    let expiring = 0;
    let expired = 0;

    // Batch writes (max 500 ops per batch).
    let batch = db.batch();
    let ops = 0;

    for (const docSnap of snap.docs) {
      const member = docSnap.data() as Member;
      const end = member.current_membership_summary?.membership_end_date ?? null;
      const newStatus = deriveMemberStatus(end, todayIso, reminder_days);

      countBucket(newStatus, () => active++, () => expiring++, () => expired++);

      if (member.member_status_key !== newStatus) {
        changed++;
        const patch: Record<string, unknown> = {
          member_status_key: newStatus,
          updated_at: nowIso(),
        };
        if (member.current_membership_summary) {
          patch["current_membership_summary.member_status_key"] = newStatus;
        }
        batch.set(docSnap.ref, patch, { merge: true });
        ops++;
        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    // Rebuild counter buckets to the true values (self-healing).
    const countersRef = db.doc(path.counters(gym_profile_id));
    batch.set(
      countersRef,
      {
        active_count: active,
        expiring_count: expiring,
        expired_count: expired,
        updated_at: nowIso(),
      },
      { merge: true },
    );
    ops++;
    if (ops > 0) await batch.commit();

    return ok({
      scanned: snap.size,
      changed,
      active_count: active,
      expiring_count: expiring,
      expired_count: expired,
    });
  } catch {
    return err("internal", "Status recompute failed.");
  }
}

function countBucket(
  status: MemberStatusKey,
  onActive: () => void,
  onExpiring: () => void,
  onExpired: () => void,
) {
  if (status === MEMBER_STATUS_KEYS.ACTIVE) onActive();
  else if (status === MEMBER_STATUS_KEYS.EXPIRING_SOON) onExpiring();
  else if (status === MEMBER_STATUS_KEYS.EXPIRED) onExpired();
}
