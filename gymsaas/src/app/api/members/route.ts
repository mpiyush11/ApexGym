/** /api/members — list/search (staff) + create (staff). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { getGymBasics } from "@/lib/services/gym.server";
import { memberCreateSchema } from "@/lib/services/member.schema";
import { listMembers, searchMembers, createMember } from "@/lib/services/member.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET(request: Request) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const cursor = url.searchParams.get("cursor");

  if (q && q.trim()) {
    const res = await searchMembers(guard.gym_profile_id, q);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
    return NextResponse.json({ data: { members: res.data, next_cursor: null } });
  }

  const res = await listMembers(guard.gym_profile_id, { cursor });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function POST(request: Request) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = memberCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const { gym_display_name } = await getGymBasics(guard.gym_profile_id);
  const res = await createMember(
    guard.gym_profile_id,
    gym_display_name,
    { app_user_id: guard.user.uid, display_name: guard.user.email ?? guard.role },
    parsed.data,
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
