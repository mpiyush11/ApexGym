/** /api/plans — list (staff) + create (owner). */
import { NextResponse } from "next/server";
import { requireStaff, requireOwner } from "@/lib/auth/guard.server";
import { getGymCurrency } from "@/lib/services/gym.server";
import { planInputSchema } from "@/lib/services/plan.schema";
import { listPlans, createPlan } from "@/lib/services/plan.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const currency = await getGymCurrency(guard.gym_profile_id);
  const res = await listPlans(guard.gym_profile_id, currency);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function POST(request: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = planInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const currency = await getGymCurrency(guard.gym_profile_id);
  const res = await createPlan(guard.gym_profile_id, currency, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
