/**
 * Firebase CLIENT initialization — ENV-SAFE.
 *
 * If Firebase is not configured, every getter returns `null` instead of
 * throwing. Callers must handle null (the UI shows a "configuration needed"
 * banner). This guarantees no white-screen crashes and no infinite loaders.
 */
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseWebConfig, firebaseStatus, appCheckSiteKey } from "@/lib/config/env";

let app: FirebaseApp | null = null;

function getClientApp(): FirebaseApp | null {
  if (!firebaseStatus.isConfigured) return null;
  if (app) return app;
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseWebConfig);
    return app;
  } catch {
    // Never throw at import/runtime due to Firebase init issues.
    return null;
  }
}

export function getClientAuth(): Auth | null {
  const a = getClientApp();
  if (!a) return null;
  try {
    return getAuth(a);
  } catch {
    return null;
  }
}

export function getClientDb(): Firestore | null {
  const a = getClientApp();
  if (!a) return null;
  try {
    return getFirestore(a);
  } catch {
    return null;
  }
}

export function getClientStorage(): FirebaseStorage | null {
  const a = getClientApp();
  if (!a) return null;
  try {
    return getStorage(a);
  } catch {
    return null;
  }
}

// Keep the App Check instance so we can fetch tokens for public requests.
let appCheckInstance: import("firebase/app-check").AppCheck | null = null;

/**
 * Initialize App Check (best-effort). Safe no-op if not configured.
 * Call once from a client provider after mount.
 */
export async function initAppCheckSafely(): Promise<void> {
  const a = getClientApp();
  if (!a || !appCheckSiteKey || appCheckInstance) return;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(
      "firebase/app-check"
    );
    appCheckInstance = initializeAppCheck(a, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check is defense-in-depth; failure must not break the app.
  }
}

/**
 * Get an App Check token for sending with public requests. Returns null when
 * App Check is not configured/available (env-safe — caller still submits).
 */
export async function getAppCheckTokenSafely(): Promise<string | null> {
  if (!appCheckSiteKey) return null;
  try {
    if (!appCheckInstance) await initAppCheckSafely();
    if (!appCheckInstance) return null;
    const { getToken } = await import("firebase/app-check");
    const res = await getToken(appCheckInstance, false);
    return res.token ?? null;
  } catch {
    return null;
  }
}

export const isFirebaseReady = firebaseStatus.isConfigured;
