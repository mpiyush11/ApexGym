/**
 * Membership history (read-only). Periods are immutable; we never expose an
 * update/delete here. Listed newest-first for the member detail timeline.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { ok, err, type Result } from "@/lib/utils/result";
import type { Membership } from "@/lib/domain/types";

export async function listMembershipHistory(
  gym_profile_id: string,
  member_id: string,
): Promise<Result<Membership[]>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const col = db
      .doc(`${path.members(gym_profile_id)}/${member_id}`)
      .collection(SUBCOLLECTIONS.MEMBERSHIPS);
    const snap = await col.orderBy("created_at", "desc").limit(50).get();
    return ok(snap.docs.map((d) => d.data() as Membership));
  } catch {
    return err("internal", "Could not load membership history.");
  }
}
