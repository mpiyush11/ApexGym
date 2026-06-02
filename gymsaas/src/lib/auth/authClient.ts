/**
 * Client auth helpers (env-safe). Wrap Firebase Auth so UI never calls the SDK
 * directly and we always have a clear error/fallback path (no infinite loaders).
 *
 * Supports BOTH member-auth methods chosen for V1:
 *   - email + password (staff + members)
 *   - phone OTP (members, primary) — helpers exposed for the member portal.
 *
 * After any successful sign-in we exchange the ID token for a secure session
 * cookie via /api/auth/session.
 */
"use client";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
  type ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { ok, err, type Result } from "@/lib/utils/result";

async function establishSession(auth: Auth): Promise<Result<true>> {
  const current = auth.currentUser;
  if (!current) return err("unauthenticated", "No signed-in user.");
  try {
    const idToken = await current.getIdToken(true);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return err(
        body?.error?.code ?? "internal",
        body?.error?.message ?? "Could not start session.",
      );
    }
    return ok(true);
  } catch {
    return err("internal", "Network error while starting session.");
  }
}

/**
 * Re-mint the session cookie from a FRESH ID token.
 *
 * Critical after onboarding: custom claims (gym_profile_id, role) are set
 * server-side AFTER the original cookie was issued, so the cookie is stale.
 * Forcing `getIdToken(true)` pulls the new claims, and re-POSTing to
 * /api/auth/session bakes them into a new session cookie. Without this the
 * protected layout reads a claimless cookie and bounces the user back to
 * onboarding (redirect loop).
 */
export async function refreshSession(): Promise<Result<true>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  return establishSession(auth);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<Result<true>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch {
    return err("unauthenticated", "Incorrect email or password.");
  }
  return establishSession(auth);
}

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<Result<true>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch {
    return err("conflict", "Could not create account. Email may be in use.");
  }
  return establishSession(auth);
}

/** Phone OTP — step 1: send code. Returns a confirmation handle. */
export async function startPhoneSignIn(
  phoneE164: string,
  recaptchaContainerId: string,
): Promise<Result<ConfirmationResult>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  try {
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
    });
    const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
    return ok(confirmation);
  } catch {
    return err("internal", "Could not send the verification code.");
  }
}

/** Phone OTP — step 2: confirm code, then establish session. */
export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<Result<true>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  try {
    await confirmation.confirm(code);
  } catch {
    return err("unauthenticated", "Invalid verification code.");
  }
  return establishSession(auth);
}

/**
 * Member portal login: confirm the OTP, bind to a member in `gym_slug` server-
 * side (claims are set there from the VERIFIED phone), then re-mint the session
 * cookie so it carries the member claims. Used by the member portal only.
 */
export async function confirmPhoneAndBindMember(
  confirmation: ConfirmationResult,
  code: string,
  gymSlug: string,
): Promise<Result<true>> {
  const auth = getClientAuth();
  if (!auth) return err("not_configured", "Authentication is not configured.");
  let idToken: string;
  try {
    const cred = await confirmation.confirm(code);
    idToken = await cred.user.getIdToken(true);
  } catch {
    return err("unauthenticated", "Invalid verification code.");
  }
  // Bind on the server (sets custom claims from the verified phone).
  try {
    const res = await fetch("/api/member/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken, gym_slug: gymSlug }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return err(body?.error?.code ?? "internal", body?.error?.message ?? "Sign-in failed.");
    }
  } catch {
    return err("internal", "Network error during sign-in.");
  }
  // Re-mint the session cookie so it carries the new member claims.
  return establishSession(auth);
}

export async function signOut(): Promise<void> {
  const auth = getClientAuth();
  try {
    if (auth) await fbSignOut(auth);
  } catch {
    /* ignore */
  }
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

export interface ResolvedClaims {
  uid: string;
  email: string | null;
  gym_profile_id: string | null;
  role: string | null;
  member_id: string | null;
}

/** Read resolved tenant/role from the server (source of truth = session cookie). */
export async function fetchClaims(): Promise<ResolvedClaims | null> {
  try {
    const res = await fetch("/api/auth/claims", { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as ResolvedClaims;
  } catch {
    return null;
  }
}
