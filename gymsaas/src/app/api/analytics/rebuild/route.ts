/**
 * POST /api/analytics/rebuild — reconstruct monthly rollups from the immutable
 * membership records. Owner-triggered (manual self-heal) or scheduler via
 * CRON_SECRET. This is the only path that scans memberships.
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { getGymBasics } from "@/lib/services/gym.server";
import { rebuildAnalytics } from "@/lib/services/analytics.service";
import { httpStatusForError } from "@/lib/utils/result";

function hasValidCronSecret(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  // Scheduler path.
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
    const basics = await getGymBasics(gymId);
    const res = await rebuildAnalytics(gymId, basics.default_currency_code);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
    return NextResponse.json({ data: res.data });
  }

  // Owner manual path.
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const basics = await getGymBasics(guard.gym_profile_id);
  const res = await rebuildAnalytics(guard.gym_profile_id, basics.default_currency_code);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
