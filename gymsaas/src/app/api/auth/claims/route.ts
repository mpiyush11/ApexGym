/**
 * GET /api/auth/claims — returns the current user's resolved tenant + role.
 * Used by the client after login to decide where to route (onboarding vs app)
 * and to detect when a token refresh is needed after claims change.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session.server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Not signed in." } },
      { status: 401 },
    );
  }
  return NextResponse.json({
    data: {
      uid: user.uid,
      email: user.email ?? null,
      gym_profile_id: user.claims.gym_profile_id ?? null,
      role: user.claims.role ?? null,
      member_id: user.claims.member_id ?? null,
    },
  });
}
