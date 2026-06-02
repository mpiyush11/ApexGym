/** Zod validation for members. */
import { z } from "zod";
import { MEMBER_TIER_KEYS } from "@/lib/domain/constants";

const tierKeys = [
  MEMBER_TIER_KEYS.STANDARD,
  MEMBER_TIER_KEYS.GOLD,
  MEMBER_TIER_KEYS.PLATINUM,
] as const;

// Phone is the primary human key in India; keep validation forgiving but present.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Phone number is too long");

export const memberCreateSchema = z.object({
  member_display_name: z.string().trim().min(2, "Name is too short").max(80),
  member_phone: phone,
  member_email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  member_tier_key: z.enum(tierKeys).default(MEMBER_TIER_KEYS.STANDARD),
  member_photo_url: z.string().trim().url().optional().or(z.literal("")),
  member_notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

export const memberUpdateSchema = memberCreateSchema.partial();
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
