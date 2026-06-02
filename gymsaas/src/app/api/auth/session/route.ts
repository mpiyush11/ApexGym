/**
 * Session login/logout.
 *
 * POST  { idToken }  -> verifies the Firebase ID token (Admin SDK) and sets a
 *                       secure httpOnly session cookie.
 * DELETE             -> clears the session cookie (logout).
 *
 * Env-safe: returns 503 (not 500/crash) when Admin SDK is unconfigured.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session.server";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const auth = getAdminAuth();
  if (!auth) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Auth is not configured." } },
      { status: 503 },
    );
  }

  let idToken: string | undefined;
  try {
    const body = (await request.json()) as { idToken?: string };
    idToken = body.idToken;
  } catch {
    idToken = undefined;
  }
  if (!idToken) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Missing idToken." } },
      { status: 422 },
    );
  }

  try {
    // Verify before minting a session cookie.
    await auth.verifyIdToken(idToken, true);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIVE_DAYS_MS / 1000,
    });
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Invalid credentials." } },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE_NAME);
  } catch {
    // ignore — logout must always succeed from the client's perspective
  }
  return NextResponse.json({ data: { ok: true } });
}
