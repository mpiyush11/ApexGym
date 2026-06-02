/** GET/PATCH /api/settings — owner-only gym settings (existing data). */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { settingsUpdateSchema } from "@/lib/services/settings.schema";
import { getSettingsView, updateSettings } from "@/lib/services/settingsUpdate.service";
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
  const res = await getSettingsView(guard.gym_profile_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function PATCH(request: Request) {
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
  const parsed = settingsUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await updateSettings(guard.gym_profile_id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });

  await writeActivityLog({
    gym_profile_id: guard.gym_profile_id,
    actor_app_user_id: guard.user.uid,
    actor_display_name: guard.user.email ?? "owner",
    action_key: "settings.update",
    entity_type: "settings",
    entity_id: guard.gym_profile_id,
    summary: "Updated gym settings",
  });

  return NextResponse.json({ data: { ok: true } });
}
