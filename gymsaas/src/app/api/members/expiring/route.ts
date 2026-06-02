/** GET /api/members/expiring — expiring + expired worklist (staff). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { listExpiringMembers } from "@/lib/services/member.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const res = await listExpiringMembers(guard.gym_profile_id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
