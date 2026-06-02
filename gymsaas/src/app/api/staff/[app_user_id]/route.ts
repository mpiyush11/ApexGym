/** PATCH /api/staff/[app_user_id] — owner-only activate/deactivate reception. */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { setStaffActiveSchema } from "@/lib/services/settings.schema";
import { setStaffActive } from "@/lib/services/staff.service";
import { writeActivityLog } from "@/lib/services/activityLog.server";
import { httpStatusForError } from "@/lib/utils/result";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ app_user_id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const { app_user_id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = setStaffActiveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await setStaffActive(guard.gym_profile_id, app_user_id, parsed.data.is_active);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });

  await writeActivityLog({
    gym_profile_id: guard.gym_profile_id,
    actor_app_user_id: guard.user.uid,
    actor_display_name: guard.user.email ?? "owner",
    action_key: parsed.data.is_active ? "staff.activate" : "staff.deactivate",
    entity_type: "app_user",
    entity_id: app_user_id,
    summary: `${parsed.data.is_active ? "Activated" : "Deactivated"} staff ${app_user_id}`,
  });

  return NextResponse.json({ data: { ok: true } });
}
