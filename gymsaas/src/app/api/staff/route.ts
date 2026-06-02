/** GET/POST /api/staff — owner-only reception management (existing app_users). */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { inviteReceptionSchema } from "@/lib/services/settings.schema";
import { listStaff, inviteReception } from "@/lib/services/staff.service";
import { writeActivityLog } from "@/lib/services/activityLog.server";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const res = await listStaff(guard.gym_profile_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function POST(request: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = inviteReceptionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await inviteReception(guard.gym_profile_id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });

  await writeActivityLog({
    gym_profile_id: guard.gym_profile_id,
    actor_app_user_id: guard.user.uid,
    actor_display_name: guard.user.email ?? "owner",
    action_key: "staff.invite",
    entity_type: "app_user",
    entity_id: res.data.app_user_id,
    summary: `Invited reception staff ${parsed.data.email}`,
  });

  return NextResponse.json({ data: res.data });
}
