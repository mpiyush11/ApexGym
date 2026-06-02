/**
 * Server-side session verification (env-safe).
 *
 * We use Firebase session cookies (set after the client signs in and posts its
 * ID token to /api/auth/session). On every protected request we verify the
 * cookie with the Admin SDK and resolve { uid, claims }.
 *
 * Returns null (never throws) when:
 *   - admin SDK is not configured,
 *   - no cookie present,
 *   - cookie invalid/expired.
 */
import "server-only";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { readClaims, type AppClaims } from "./claims";

export const SESSION_COOKIE_NAME = "gymos_session";

export interface SessionUser {
  uid: string;
  email?: string;
  claims: AppClaims;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = getAdminAuth();
  if (!auth) return null;

  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  try {
    const decoded = await auth.verifySessionCookie(token, true);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      claims: readClaims(decoded as unknown as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

/** Require a session with a specific tenant; returns null if not authorized. */
export async function requireTenantSession(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (!user.claims.gym_profile_id || !user.claims.role) return null;
  return user;
}
