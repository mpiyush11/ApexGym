/**
 * POST /api/cron/recompute-status — daily status + counter recompute.
 *
 * Auth: either a logged-in OWNER (manual "refresh" button) OR a scheduler
 * carrying the CRON_SECRET bearer token. Env-safe: if no secret is configured,
 * only owner-triggered runs are allowed (no insecure open endpoint).
 *
 * Scope: recomputes the CURRENT tenant when owner-triggered. For platform-wide
 * scheduled runs, a gym_profile_id can be passed with the cron secret.
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { getGymSettings } from "@/lib/services/settings.server";
import { recomputeGymStatuses } from "@/lib/services/statusRecompute.service";
import { httpStatusForError } from "@/lib/utils/result";

function hasValidCronSecret(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  // Path 1: scheduler with cron secret + explicit gym_profile_id.
  if (hasValidCronSecret(request)) {
    let gymId: string | null = null;
    try {
      const body = (await request.json()) as { gym_profile_id?: string };
      gymId = body.gym_profile_id ?? null;
    } catch {
      gymId = null;
    }
    if (!gymId) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: "gym_profile_id required." } },
        { status: 422 },
      );
    }
    const settings = await getGymSettings(gymId);
    const res = await recomputeGymStatuses(gymId, settings.renewal_reminder_days_before);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
    return NextResponse.json({ data: res.data });
  }

  // Path 2: owner-triggered manual refresh for their own gym.
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const settings = await getGymSettings(guard.gym_profile_id);
  const res = await recomputeGymStatuses(guard.gym_profile_id, settings.renewal_reminder_days_before);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
