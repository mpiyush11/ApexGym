/** Zod validation for tenant onboarding (boundary validation, audit 6.4). */
import { z } from "zod";

export const onboardingSchema = z.object({
  gym_display_name: z
    .string()
    .trim()
    .min(2, "Gym name must be at least 2 characters")
    .max(80, "Gym name is too long"),
  // gym_slug is optional; if omitted we derive it from the display name.
  gym_slug: z
    .string()
    .trim()
    .toLowerCase()
    .optional(),
  owner_display_name: z
    .string()
    .trim()
    .min(2, "Your name must be at least 2 characters")
    .max(80),
  gym_contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
  gym_whatsapp_number: z.string().trim().max(20).optional().or(z.literal("")),
  gym_city: z.string().trim().max(60).optional().or(z.literal("")),
  default_currency_code: z.string().trim().length(3).default("INR"),
  gym_timezone: z.string().trim().min(3).default("Asia/Kolkata"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
