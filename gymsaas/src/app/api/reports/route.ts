/** GET /api/reports — owner-only report history. */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { listReports } from "@/lib/services/report.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const res = await listReports(guard.gym_profile_id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
