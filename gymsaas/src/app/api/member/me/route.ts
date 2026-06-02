/** GET /api/member/me — digital card bundle for the signed-in member. */
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/guard.server";
import { getMemberCard } from "@/lib/services/memberPortal.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireMember();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const res = await getMemberCard(guard.gym_profile_id, guard.member_id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
