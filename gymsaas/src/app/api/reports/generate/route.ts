/**
 * POST /api/reports/generate — build the weekly report snapshot.
 * Owner-triggered ("Generate now") OR scheduler via CRON_SECRET (weekly).
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { generateWeeklyReport } from "@/lib/services/report.service";
import { httpStatusForError } from "@/lib/utils/result";

function hasValidCronSecret(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  // Scheduler path (weekly cron) — explicit gym_profile_id.
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
    const res = await generateWeeklyReport(gymId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
    return NextResponse.json({ data: res.data });
  }

  // Owner "Generate now".
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const res = await generateWeeklyReport(guard.gym_profile_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
