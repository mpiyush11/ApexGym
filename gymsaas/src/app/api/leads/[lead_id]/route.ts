/** PATCH /api/leads/[lead_id] — staff status change (pipeline). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { leadStatusSchema } from "@/lib/services/lead.schema";
import { setLeadStatus } from "@/lib/services/lead.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lead_id: string }> },
) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const { lead_id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = leadStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid status." } },
      { status: 422 },
    );
  }

  const res = await setLeadStatus(guard.gym_profile_id, lead_id, parsed.data.lead_status_key);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
