/** POST /api/members/[member_id]/renew — transactional renewal (staff). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { getGymBasics } from "@/lib/services/gym.server";
import { getGymSettings } from "@/lib/services/settings.server";
import { renewalSchema } from "@/lib/services/renewal.schema";
import { renewMembership } from "@/lib/services/renewal.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function POST(
  request: Request,
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = renewalSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }

  const [basics, settings] = await Promise.all([
    getGymBasics(guard.gym_profile_id),
    getGymSettings(guard.gym_profile_id),
  ]);

  const res = await renewMembership(
    {
      gym_profile_id: guard.gym_profile_id,
      gym_timezone: basics.gym_timezone,
      currency_code: basics.default_currency_code,
      reminder_days: settings.renewal_reminder_days_before,
      actor_app_user_id: guard.user.uid,
      actor_display_name: guard.user.email ?? "Staff",
    },
    member_id,
    parsed.data,
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
