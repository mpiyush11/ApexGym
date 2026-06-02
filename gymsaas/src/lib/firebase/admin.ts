/**
 * Firebase ADMIN initialization — SERVER ONLY, ENV-SAFE.
 *
 * NEVER import this from client components. It uses the service account
 * (privileged) and is used by route handlers / server actions / Cloud
 * Functions-style server logic for:
 *   - serving public site content via Admin SDK (so client rules stay locked),
 *   - setting custom claims (gym_profile_id + role),
 *   - privileged reads/writes that bypass security rules intentionally.
 *
 * If admin credentials are missing, getters return null. Callers must handle
 * it and respond with a clear, non-fatal error (no crash).
 */
import "server-only";

import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminConfig } from "@/lib/config/env";

let adminApp: App | null = null;

function getAdminApp(): App | null {
  const cfg = getAdminConfig();
  if (!cfg.isConfigured) return null;
  if (adminApp) return adminApp;
  try {
    adminApp = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: cfg.projectId,
            clientEmail: cfg.clientEmail,
            privateKey: cfg.privateKey,
          }),
        });
    return adminApp;
  } catch {
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  const a = getAdminApp();
  if (!a) return null;
  try {
    return getAuth(a);
  } catch {
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  const a = getAdminApp();
  if (!a) return null;
  try {
    return getFirestore(a);
  } catch {
    return null;
  }
}

export function getAdminStorage() {
  const a = getAdminApp();
  if (!a) return null;
  try {
    return getStorage(a);
  } catch {
    return null;
  }
}

/**
 * Verify a Firebase App Check token (server-side). Returns:
 *   - "valid"        token verified
 *   - "invalid"      token present but failed verification
 *   - "unconfigured" admin/App Check not available (env-safe: caller decides)
 *   - "missing"      no token supplied
 */
export async function verifyAppCheckToken(
  token: string | null | undefined,
): Promise<"valid" | "invalid" | "unconfigured" | "missing"> {
  const a = getAdminApp();
  if (!a) return "unconfigured";
  if (!token) return "missing";
  try {
    const { getAppCheck } = await import("firebase-admin/app-check");
    await getAppCheck(a).verifyToken(token);
    return "valid";
  } catch {
    return "invalid";
  }
}

export const isAdminReady = getAdminConfig().isConfigured;
