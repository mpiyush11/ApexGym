/**
 * Centralized, ENV-SAFE configuration loader.
 *
 * MANDATORY RULE (Env Safety): the app must NEVER crash at import time
 * because of a missing environment variable. This module reads every value
 * defensively with direct explicit references required by Next.js static analysis.
 */

// ── App-wide settings (always have safe defaults) ──────────────
export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "GymOS",
  defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "INR",
  defaultTimezone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || "Asia/Kolkata",
  isProduction: process.env.NODE_ENV === "production",
} as const;

// ── Firebase Web (client config block) ─────────────────────────
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
} as const;

export const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY || "";

// Client-side static validation logic
const requiredWebKeys = [
  { name: "NEXT_PUBLIC_FIREBASE_API_KEY", value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY },
  { name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
  { name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  { name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET },
  { name: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID },
  { name: "NEXT_PUBLIC_FIREBASE_APP_ID", value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID }
];

const missingWebKeys = requiredWebKeys.filter(k => !k.value || k.value.trim() === "").map(k => k.name);
const isWebConfigValid = missingWebKeys.length === 0;

export const firebaseStatus = {
  /** True only when ALL required web keys are present statically. */
  isConfigured: isWebConfigValid,
  missing: missingWebKeys,
  appCheckConfigured: appCheckSiteKey !== "",
} as const;

// ── Firebase Admin (server only) ───────────────────────────────
export function getAdminConfig() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "";
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || "";
  
  // Private keys in env are stored with literal "\n"; normalize them.
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const isConfigured = Boolean(projectId && clientEmail && privateKey);
  
  return { projectId, clientEmail, privateKey, isConfigured };
}
