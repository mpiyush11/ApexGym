/**
 * Owner settings updates (server-only). Exposes EXISTING data (gym_profile +
 * settings singleton) — no new collection. Owner-only at the API layer.
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path } from "@/lib/firebase/paths";
import { nowIso } from "@/lib/utils/time";
import { ok, err, type Result } from "@/lib/utils/result";

export interface GymSettingsView {
  gym_slug: string;
  gym_display_name: string;
  gym_whatsapp_number: string;
  gym_contact_phone: string;
  gym_contact_email: string;
  gym_city: string;
  default_currency_code: string;
  gym_timezone: string;
  renewal_reminder_days_before: number;
  report_recipient_emails: string[];
  public_site_is_published: boolean;
}

export async function getSettingsView(
  gym_profile_id: string,
): Promise<Result<GymSettingsView>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  try {
    const [pSnap, sSnap] = await Promise.all([
      db.doc(path.gymProfile(gym_profile_id)).get(),
      db.doc(path.settings(gym_profile_id)).get(),
    ]);
    const p = pSnap.data() ?? {};
    const s = sSnap.data() ?? {};
    return ok({
      gym_slug: p.gym_slug ?? "",
      gym_display_name: p.gym_display_name ?? "",
      gym_whatsapp_number: p.gym_whatsapp_number ?? "",
      gym_contact_phone: p.gym_contact_phone ?? "",
      gym_contact_email: p.gym_contact_email ?? "",
      gym_city: p.gym_city ?? "",
      default_currency_code: p.default_currency_code ?? "INR",
      gym_timezone: p.gym_timezone ?? "Asia/Kolkata",
      renewal_reminder_days_before: Number(s.renewal_reminder_days_before) || 7,
      report_recipient_emails: Array.isArray(s.report_recipient_emails)
        ? s.report_recipient_emails
        : [],
      public_site_is_published: Boolean(p.public_site_is_published),
    });
  } catch {
    return err("internal", "Could not load settings.");
  }
}

export interface SettingsUpdateInput {
  gym_display_name: string;
  gym_whatsapp_number?: string;
  gym_contact_phone?: string;
  gym_contact_email?: string;
  gym_city?: string;
  renewal_reminder_days_before: number;
  report_recipient_emails: string[];
  public_site_is_published: boolean;
}

export async function updateSettings(
  gym_profile_id: string,
  input: SettingsUpdateInput,
): Promise<Result<true>> {
  const db = getAdminDb();
  if (!db) return err("not_configured", "Database not configured.");
  const now = nowIso();
  try {
    const batch = db.batch();
    batch.set(
      db.doc(path.gymProfile(gym_profile_id)),
      {
        gym_display_name: input.gym_display_name,
        gym_whatsapp_number: input.gym_whatsapp_number ?? "",
        gym_contact_phone: input.gym_contact_phone ?? "",
        gym_contact_email: input.gym_contact_email ?? "",
        gym_city: input.gym_city ?? "",
        public_site_is_published: input.public_site_is_published,
        updated_at: now,
      },
      { merge: true },
    );
    batch.set(
      db.doc(path.settings(gym_profile_id)),
      {
        renewal_reminder_days_before: input.renewal_reminder_days_before,
        report_recipient_emails: input.report_recipient_emails,
      },
      { merge: true },
    );
    await batch.commit();
    return ok(true);
  } catch {
    return err("internal", "Could not save settings.");
  }
}
