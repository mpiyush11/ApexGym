/**
 * Public website data (server-only, Admin SDK).
 *
 * Anonymous visitors are NOT allowed to read tenant collections directly
 * (Security Rules lock them). So the public site is rendered on the SERVER and
 * reads the published gym's content via the Admin SDK. This keeps client rules
 * locked while still serving a fast, SEO-friendly page (SSR + ISR).
 *
 * Only returns content when the gym exists, is ACTIVE (not suspended) and has
 * `public_site_is_published = true`. Otherwise returns null → the page 404s.
 *
 * Cost: bounded reads (1 slug doc + 1 profile + 4 small content queries). The
 * page is cached via ISR so this runs at most once per revalidate window.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path, SUBCOLLECTIONS } from "@/lib/firebase/paths";
import type {
  GymProfile,
  MembershipPlan,
  Trainer,
  GalleryItem,
  Testimonial,
} from "@/lib/domain/types";

export interface PublicGymBundle {
  gym_profile_id: string;
  gym_slug: string;
  gym_display_name: string;
  gym_logo_url: string;
  gym_primary_color_hex: string;
  gym_contact_email: string;
  gym_contact_phone: string;
  gym_whatsapp_number: string;
  gym_address_line: string;
  gym_city: string;
  default_currency_code: string;
  plans: MembershipPlan[];
  trainers: Trainer[];
  gallery: GalleryItem[];
  testimonials: Testimonial[];
  hero_image_url: string | null;
}

const QUERY_LIMIT = 24;

export async function getPublicGymBundle(
  gym_slug: string,
): Promise<PublicGymBundle | null> {
  const db = getAdminDb();
  if (!db) return null;

  try {
    const idxSnap = await db.doc(path.slugIndex(gym_slug)).get();
    if (!idxSnap.exists) return null;
    const gym_profile_id = String(idxSnap.data()?.gym_profile_id ?? "");
    if (!gym_profile_id) return null;

    const profileSnap = await db.doc(path.gymProfile(gym_profile_id)).get();
    if (!profileSnap.exists) return null;
    const profile = profileSnap.data() as GymProfile;

    // Gate: must be published AND not suspended.
    if (!profile.public_site_is_published) return null;
    if (profile.gym_status_key === "suspended") return null;

    const base = `${path.gymProfile(gym_profile_id)}`;
    const [plansSnap, trainersSnap, gallerySnap, testimonialsSnap] = await Promise.all([
      db.collection(`${base}/${SUBCOLLECTIONS.PLANS}`)
        .where("is_active", "==", true)
        .limit(QUERY_LIMIT)
        .get(),
      db.collection(`${base}/${SUBCOLLECTIONS.TRAINERS}`)
        .where("is_active", "==", true)
        .limit(QUERY_LIMIT)
        .get(),
      db.collection(`${base}/${SUBCOLLECTIONS.GALLERY}`)
        .where("is_active", "==", true)
        .limit(QUERY_LIMIT)
        .get(),
      db.collection(`${base}/${SUBCOLLECTIONS.TESTIMONIALS}`)
        .where("is_active", "==", true)
        .limit(QUERY_LIMIT)
        .get(),
    ]);

    const plans = plansSnap.docs
      .map((d) => d.data() as MembershipPlan)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const trainers = trainersSnap.docs
      .map((d) => d.data() as Trainer)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const gallery = gallerySnap.docs
      .map((d) => d.data() as GalleryItem)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const testimonials = testimonialsSnap.docs
      .map((d) => d.data() as Testimonial)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    const hero =
      gallery.find((g) => g.is_hero_gallery)?.image_url ??
      gallery[0]?.image_url ??
      null;

    return {
      gym_profile_id,
      gym_slug,
      gym_display_name: profile.gym_display_name ?? "",
      gym_logo_url: profile.gym_logo_url ?? "",
      gym_primary_color_hex: profile.gym_primary_color_hex ?? "#d4af37",
      gym_contact_email: profile.gym_contact_email ?? "",
      gym_contact_phone: profile.gym_contact_phone ?? "",
      gym_whatsapp_number: profile.gym_whatsapp_number ?? "",
      gym_address_line: profile.gym_address_line ?? "",
      gym_city: profile.gym_city ?? "",
      default_currency_code: profile.default_currency_code ?? "INR",
      plans,
      trainers,
      gallery,
      testimonials,
      hero_image_url: hero,
    };
  } catch {
    return null;
  }
}
