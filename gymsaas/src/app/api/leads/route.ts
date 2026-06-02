/** GET /api/leads — staff lead pipeline (optional ?status= filter). */
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guard.server";
import { listLeads } from "@/lib/services/lead.service";
import { LEAD_STATUS_KEYS, type LeadStatusKey } from "@/lib/domain/constants";
import { httpStatusForError } from "@/lib/utils/result";

const VALID = new Set<string>(Object.values(LEAD_STATUS_KEYS));

export async function GET(request: Request) {
  const guard = await requireStaff();
  if (!guard.ok) {
    return NextResponse.json(
      { error: { code: guard.code, message: guard.message } },
      { status: httpStatusForError(guard.code) },
    );
  }
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID.has(statusParam) ? (statusParam as LeadStatusKey) : null;

  const res = await listLeads(guard.gym_profile_id, status);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: res.data });
}
