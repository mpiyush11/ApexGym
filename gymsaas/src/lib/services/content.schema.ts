/** Validation for CMS content. Required CMS fields per MANDATORY RULE 3. */
import { z } from "zod";
import { MEMBER_TIER_KEYS } from "@/lib/domain/constants";

export const trainerSchema = z.object({
  trainer_display_name: z.string().trim().min(2).max(80),
  trainer_specialty: z.string().trim().max(80).optional().or(z.literal("")),
  trainer_bio: z.string().trim().max(500).optional().or(z.literal("")),
  trainer_photo_url: z.string().trim().url().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).max(999).default(0),
});

export const gallerySchema = z.object({
  image_url: z.string().trim().url("Enter a valid image URL"),
  image_title: z.string().trim().min(1).max(80), // RULE 3
  area_category: z.string().trim().min(1).max(40), // RULE 3
  is_hero_gallery: z.boolean().default(false), // RULE 3
  is_active: z.boolean().default(true), // RULE 3
  display_order: z.number().int().min(0).max(999).default(0),
});

const tierKeys = [
  MEMBER_TIER_KEYS.STANDARD,
  MEMBER_TIER_KEYS.GOLD,
  MEMBER_TIER_KEYS.PLATINUM,
] as const;

export const testimonialSchema = z.object({
  testimonial_text: z.string().trim().min(4).max(400), // RULE 3
  member_since_year: z.number().int().min(1950).max(2100), // RULE 3
  member_tier_key: z.enum(tierKeys).default(MEMBER_TIER_KEYS.STANDARD), // RULE 3
  author_display_name: z.string().trim().min(2).max(80),
  author_photo_url: z.string().trim().url().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).max(999).default(0),
});

export function schemaFor(kind: string) {
  if (kind === "trainers") return trainerSchema;
  if (kind === "gallery") return gallerySchema;
  if (kind === "testimonials") return testimonialSchema;
  return null;
}
