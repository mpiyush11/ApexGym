/** Small helpers to read gym-level config server-side (currency, name). */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { path } from "@/lib/firebase/paths";
import { appConfig } from "@/lib/config/env";

interface GymBasics {
  gym_display_name: string;
  default_currency_code: string;
  gym_timezone: string;
}

export async function getGymBasics(gym_profile_id: string): Promise<GymBasics> {
  const db = getAdminDb();
  const fallback: GymBasics = {
    gym_display_name: appConfig.appName,
    default_currency_code: appConfig.defaultCurrency,
    gym_timezone: appConfig.defaultTimezone,
  };
  if (!db) return fallback;
  try {
    const snap = await db.doc(path.gymProfile(gym_profile_id)).get();
    if (!snap.exists) return fallback;
    const d = snap.data() ?? {};
    return {
      gym_display_name: d.gym_display_name || fallback.gym_display_name,
      default_currency_code: d.default_currency_code || fallback.default_currency_code,
      gym_timezone: d.gym_timezone || fallback.gym_timezone,
    };
  } catch {
    return fallback;
  }
}

export async function getGymCurrency(gym_profile_id: string): Promise<string> {
  return (await getGymBasics(gym_profile_id)).default_currency_code;
}

/**
 * Short-lived in-process cache of gym status so the suspension check in the
 * auth guard does not add a Firestore read to every API call. TTL keeps it
 * fresh enough for billing enforcement (a suspended gym is locked within ~60s).
 */
const statusCache = new Map<string, { suspended: boolean; expires: number }>();
const STATUS_TTL_MS = 60_000;

export async function isGymSuspended(gym_profile_id: string): Promise<boolean> {
  const cached = statusCache.get(gym_profile_id);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.suspended;

  const db = getAdminDb();
  if (!db) return false; // env-safe: never lock out when DB is unconfigured
  try {
    const snap = await db.doc(path.gymProfile(gym_profile_id)).get();
    const suspended = snap.exists && snap.data()?.gym_status_key === "suspended";
    statusCache.set(gym_profile_id, { suspended, expires: now + STATUS_TTL_MS });
    return suspended;
  } catch {
    return false; // fail open on read error; do not block paying gyms
  }
}
