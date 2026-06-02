/** GET /api/members/[member_id]/history — immutable membership periods (staff). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { listMembershipHistory } from "@/lib/services/membership.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ member_id: string }> },
) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const { member_id } = await params;
  const res = await listMembershipHistory(guard.gym_profile_id, member_id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
