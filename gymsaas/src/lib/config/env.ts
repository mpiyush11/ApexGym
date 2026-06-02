/**
 * Centralized, ENV-SAFE configuration loader.
 *
 * MANDATORY RULE (Env Safety): the app must NEVER crash at import time
 * because of a missing environment variable. This module:
 *   - reads every value defensively,
 *   - provides safe fallbacks,
 *   - exposes `isConfigured` flags so the UI can show a clear
 *     "configuration needed" state instead of an infinite loader.
 *
 * It throws NOTHING. Validation is reported, never fatal.
 */

function read(key: string): string {
  // process.env access is statically replaced by Next for NEXT_PUBLIC_* on the client.
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredList(keys: string[]): { ok: boolean; missing: string[] } {
  const missing = keys.filter((k) => read(k) === "");
  return { ok: missing.length === 0, missing };
}

// ── App-wide settings (always have safe defaults) ──────────────
export const appConfig = {
  appName: read("NEXT_PUBLIC_APP_NAME") || "GymOS",
  defaultCurrency: read("NEXT_PUBLIC_DEFAULT_CURRENCY") || "INR",
  defaultTimezone: read("NEXT_PUBLIC_DEFAULT_TIMEZONE") || "Asia/Kolkata",
  isProduction: process.env.NODE_ENV === "production",
} as const;

// ── Firebase Web (client) ──────────────────────────────────────
const firebaseWebKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const firebaseWebStatus = readRequiredList(firebaseWebKeys);

export const firebaseWebConfig = {
  apiKey: read("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: read("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: read("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: read("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: read("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: read("NEXT_PUBLIC_FIREBASE_APP_ID"),
} as const;

export const appCheckSiteKey = read("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY");

export const firebaseStatus = {
  /** True only when ALL required web keys are present. */
  isConfigured: firebaseWebStatus.ok,
  missing: firebaseWebStatus.missing,
  appCheckConfigured: appCheckSiteKey !== "",
} as const;

// ── Firebase Admin (server only) ───────────────────────────────
export function getAdminConfig() {
  const projectId = read("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = read("FIREBASE_ADMIN_CLIENT_EMAIL");
  // Private keys in env are stored with literal "\n"; normalize them.
  const privateKey = read("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
  const isConfigured = Boolean(projectId && clientEmail && privateKey);
  return { projectId, clientEmail, privateKey, isConfigured };
}
