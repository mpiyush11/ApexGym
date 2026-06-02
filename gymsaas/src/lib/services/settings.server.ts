/** Read per-gym settings server-side, with safe fallbacks (env-safety). */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path } from "@/lib/firebase/paths";

export interface GymSettingsResolved {
  renewal_reminder_days_before: number;
  report_recipient_emails: string[];
  whatsapp_default_message_template: string;
}

const DEFAULTS: GymSettingsResolved = {
  renewal_reminder_days_before: 7,
  report_recipient_emails: [],
  whatsapp_default_message_template:
    "Hi {member_display_name}, your membership at {gym_display_name} expires on {membership_end_date}. Renew today!",
};

export async function getGymSettings(
  gym_profile_id: string,
): Promise<GymSettingsResolved> {
  const db = getAdminDb();
  if (!db) return DEFAULTS;
  try {
    const snap = await db.doc(path.settings(gym_profile_id)).get();
    if (!snap.exists) return DEFAULTS;
    const d = snap.data() ?? {};
    return {
      renewal_reminder_days_before:
        Number(d.renewal_reminder_days_before) || DEFAULTS.renewal_reminder_days_before,
      report_recipient_emails: Array.isArray(d.report_recipient_emails)
        ? d.report_recipient_emails
        : DEFAULTS.report_recipient_emails,
      whatsapp_default_message_template:
        d.whatsapp_default_message_template || DEFAULTS.whatsapp_default_message_template,
    };
  } catch {
    return DEFAULTS;
  }
}
