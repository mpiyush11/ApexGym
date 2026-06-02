/**
 * Lead validation.
 *  - publicContactSchema: what an unauthenticated visitor submits. Includes
 *    spam-trap fields (honeypot + render timestamp) that are validated then
 *    stripped — never stored.
 *  - leadStatusSchema: staff pipeline status changes.
 */
import { z } from "zod";
import { LEAD_STATUS_KEYS } from "@/lib/domain/constants";

export const publicContactSchema = z.object({
  lead_display_name: z.string().trim().min(2, "Please enter your name").max(80),
  lead_phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  lead_email: z.string().trim().email("Invalid email").max(120).optional().or(z.literal("")),
  lead_message: z.string().trim().max(500).optional().or(z.literal("")),
  // Honeypot: must stay empty. Bots fill it.
  company_website: z.string().max(0).optional().or(z.literal("")),
  // Anti-bot timing: client sends the time the form was rendered (ms epoch).
  form_rendered_at: z.number().int().nonnegative().optional(),
});

export type PublicContactInput = z.infer<typeof publicContactSchema>;

const statusKeys = [
  LEAD_STATUS_KEYS.NEW,
  LEAD_STATUS_KEYS.CONTACTED,
  LEAD_STATUS_KEYS.TRIAL,
  LEAD_STATUS_KEYS.CONVERTED,
  LEAD_STATUS_KEYS.LOST,
] as const;

export const leadStatusSchema = z.object({
  lead_status_key: z.enum(statusKeys),
});

export type LeadStatusInput = z.infer<typeof leadStatusSchema>;
