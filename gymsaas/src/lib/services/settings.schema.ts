/** Validation for owner settings + reception invite. */
import { z } from "zod";

export const settingsUpdateSchema = z.object({
  gym_display_name: z.string().trim().min(2).max(80),
  gym_whatsapp_number: z.string().trim().max(20).optional().or(z.literal("")),
  gym_contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
  gym_contact_email: z.string().trim().email().max(120).optional().or(z.literal("")),
  gym_city: z.string().trim().max(60).optional().or(z.literal("")),
  renewal_reminder_days_before: z.number().int().min(1).max(60),
  report_recipient_emails: z.array(z.string().trim().email()).max(10).default([]),
  public_site_is_published: z.boolean(),
});
export type SettingsUpdateForm = z.infer<typeof settingsUpdateSchema>;

export const inviteReceptionSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
  display_name: z.string().trim().min(2, "Enter a name").max(80),
  temp_password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
export type InviteReceptionForm = z.infer<typeof inviteReceptionSchema>;

export const setStaffActiveSchema = z.object({
  is_active: z.boolean(),
});
