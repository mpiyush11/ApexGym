/** GET /api/analytics — owner-only, fast counter/rollup read (<2s at scale). */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { getGymBasics } from "@/lib/services/gym.server";
import { getAnalytics } from "@/lib/services/analytics.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET(request: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const url = new URL(request.url);
  const windowMonths = Math.min(24, Math.max(3, Number(url.searchParams.get("months")) || 12));

  const basics = await getGymBasics(guard.gym_profile_id);
  const res = await getAnalytics(
    guard.gym_profile_id,
    basics.default_currency_code,
    basics.gym_timezone,
    windowMonths,
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
