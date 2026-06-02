/** /api/plans/[plan_id] — update + deactivate (owner only). */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { getGymCurrency } from "@/lib/services/gym.server";
import { planInputSchema } from "@/lib/services/plan.schema";
import { updatePlan, deactivatePlan } from "@/lib/services/plan.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ plan_id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { plan_id } = await params;
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
  const res = await updatePlan(guard.gym_profile_id, currency, plan_id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ plan_id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { plan_id } = await params;
  const res = await deactivatePlan(guard.gym_profile_id, plan_id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: { ok: true } });
}
