/**
 * CMS content service (server-only) for the public website: trainers, gallery,
 * testimonials. Owner-only at the API layer (mirrors rules). Reuses existing
 * collections — no new infrastructure. All docs carry gym_profile_id so the
 * tenant-id write validation in rules is satisfied.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";
import type { Trainer, GalleryItem, Testimonial } from "@/lib/domain/types";

type ContentKind = "trainers" | "gallery" | "testimonials";

function colName(kind: ContentKind): string {
  if (kind === "trainers") return SUBCOLLECTIONS.TRAINERS;
  if (kind === "gallery") return SUBCOLLECTIONS.GALLERY;
  return SUBCOLLECTIONS.TESTIMONIALS;
}

function idField(kind: ContentKind): string {
  if (kind === "trainers") return "trainer_id";
  if (kind === "gallery") return "gallery_item_id";
  return "testimonial_id";
}

export async function listContent<T>(
  gym_profile_id: string,
  kind: ContentKind,
): Promise<Result<T[]>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const snap = await db
      .collection(`${path.gymProfile(gym_profile_id)}/${colName(kind)}`)
      .limit(100)
      .get();
    const items = snap.docs
      .map((d) => d.data() as T & { display_order?: number })
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return ok(items as T[]);
  } catch {
    return err("internal", "Could not load content.");
  }
}

export async function createContent(
  gym_profile_id: string,
  kind: ContentKind,
  data: Record<string, unknown>,
): Promise<Result<{ id: string }>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const ref = db.collection(`${path.gymProfile(gym_profile_id)}/${colName(kind)}`).doc();
    await ref.set({
      [idField(kind)]: ref.id,
      gym_profile_id,
      ...data,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    return ok({ id: ref.id });
  } catch {
    return err("internal", "Could not save content.");
  }
}

export async function updateContent(
  gym_profile_id: string,
  kind: ContentKind,
  id: string,
  data: Record<string, unknown>,
): Promise<Result<true>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    await db
      .doc(`${path.gymProfile(gym_profile_id)}/${colName(kind)}/${id}`)
      .set({ ...data, gym_profile_id, updated_at: nowIso() }, { merge: true });
    return ok(true);
  } catch {
    return err("internal", "Could not update content.");
  }
}

export async function deleteContent(
  gym_profile_id: string,
  kind: ContentKind,
  id: string,
): Promise<Result<true>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    await db.doc(`${path.gymProfile(gym_profile_id)}/${colName(kind)}/${id}`).delete();
    return ok(true);
  } catch {
    return err("internal", "Could not delete content.");
  }
}

export type { ContentKind, Trainer, GalleryItem, Testimonial };
