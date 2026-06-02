/** Zod validation for membership plans. Prices arrive in MAJOR units from the
 *  form and are converted to integer minor units server-side (Rule 2). */
import { z } from "zod";
import { PLAN_DURATION_KEYS } from "@/lib/domain/constants";

const durationKeys = [
  PLAN_DURATION_KEYS.MONTHLY,
  PLAN_DURATION_KEYS.QUARTERLY,
  PLAN_DURATION_KEYS.SEMI_ANNUAL,
  PLAN_DURATION_KEYS.ANNUAL,
] as const;

export const planInputSchema = z.object({
  plan_display_name: z.string().trim().min(2, "Name is too short").max(60),
  plan_duration_key: z.enum(durationKeys),
  // Major units (e.g. rupees). Non-negative. Converted to *_minor server-side.
  price_major: z.number().min(0, "Price cannot be negative").max(10_000_000),
  joining_fee_major: z.number().min(0).max(10_000_000).default(0),
  plan_description: z.string().trim().max(280).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).max(999).default(0),
});

export type PlanInput = z.infer<typeof planInputSchema>;
