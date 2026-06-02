/**
 * POST /api/member/login — bind a phone-OTP-verified Firebase user to a member.
 * Body: { id_token, gym_slug }. The phone is read from the VERIFIED token, not
 * the client body, so it cannot be spoofed.
 */
import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { bindMemberLogin } from "@/lib/services/memberPortal.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function POST(request: Request) {
  const auth = getAdminAuth();
  if (!auth) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Auth is not configured." } },
      { status: 503 },
    );
  }

  let body: { id_token?: string; gym_slug?: string };
  try {
    body = (await request.json()) as { id_token?: string; gym_slug?: string };
  } catch {
    body = {};
  }
  if (!body.id_token || !body.gym_slug) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Missing token or gym." } },
      { status: 422 },
    );
  }

  // Verify the token and read the VERIFIED phone from it.
  let uid: string;
  let phone: string | undefined;
  try {
    const decoded = await auth.verifyIdToken(body.id_token, true);
    uid = decoded.uid;
    phone = typeof decoded.phone_number === "string" ? decoded.phone_number : undefined;
  } catch {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Invalid sign-in. Please try again." } },
      { status: 401 },
    );
  }

  const res = await bindMemberLogin(body.gym_slug, uid, phone);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
