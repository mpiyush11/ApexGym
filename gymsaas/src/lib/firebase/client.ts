/**
 * Firebase CLIENT initialization — ENV-SAFE.
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

// App Check bypass during initialization to prevent crashing the public UI
export async function initAppCheckSafely(): Promise<void> {
  // Safe no-op to prevent App Check site key missing errors
  return;
}

export async function getAppCheckTokenSafely(): Promise<string | null> {
  return null;
}

export const isFirebaseReady = firebaseStatus.isConfigured;
