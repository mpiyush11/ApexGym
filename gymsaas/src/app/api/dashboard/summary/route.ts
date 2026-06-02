/** GET /api/dashboard/summary — counter-based metrics (staff). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { getGymCurrency } from "@/lib/services/gym.server";
import { getDashboardSummary } from "@/lib/services/dashboard.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const currency = await getGymCurrency(guard.gym_profile_id);
  const res = await getDashboardSummary(guard.gym_profile_id, currency);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }

  // Revenue is owner-only. Strip it server-side for reception (privacy) — the
  // UI also hides it, but enforcing here means it never leaves the server.
  const canViewRevenue = guard.role === "owner";
  const data = canViewRevenue
    ? { ...res.data, can_view_revenue: true }
    : { ...res.data, revenue_month_minor: 0, can_view_revenue: false };

  return NextResponse.json({ data });
}
