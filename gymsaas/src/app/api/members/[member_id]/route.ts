/** /api/members/[member_id] — get + update (staff), archive (owner). */
import { NextResponse } from "next/server";
import { requireStaff, requireOwner } from "@/lib/auth/guard.server";
import { memberUpdateSchema } from "@/lib/services/member.schema";
import { getMember, updateMember, archiveMember } from "@/lib/services/member.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ member_id: string }> },
) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { member_id } = await params;
  const res = await getMember(guard.gym_profile_id, member_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ member_id: string }> },
) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { member_id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = memberUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await updateMember(guard.gym_profile_id, member_id, parsed.data, {
    app_user_id: guard.user.uid,
    display_name: guard.user.email ?? guard.role,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ member_id: string }> },
) {
  // Soft delete (archive) — owner only (mirrors Firestore rules).
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { member_id } = await params;
  const res = await archiveMember(guard.gym_profile_id, member_id, {
    app_user_id: guard.user.uid,
    display_name: guard.user.email ?? guard.role,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: { ok: true } });
}
