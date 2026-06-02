/**
 * GET /api/reports/export/[kind] — owner-only streamed CSV (members|payments).
 * Streams existing records (no buffering); CSV-injection protected.
 */
import { requireOwner } from "@/lib/auth/guard.server";
import { getGymCurrency, isGymSuspended } from "@/lib/services/gym.server";
import { streamMembersCsv, streamPaymentsCsv } from "@/lib/services/export.service";
import { httpStatusForError } from "@/lib/utils/result";

function jsonError(code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: httpStatusForError(code),
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) return jsonError(guard.code, guard.message);

  if (await isGymSuspended(guard.gym_profile_id)) {
    return jsonError("suspended", "This gym account is suspended.");
  }

  const { kind } = await params;
  if (kind !== "members" && kind !== "payments") {
    return jsonError("not_found", "Unknown export.");
  }

  const currency = await getGymCurrency(guard.gym_profile_id);
  const stream =
    kind === "members"
      ? streamMembersCsv(guard.gym_profile_id, currency)
      : streamPaymentsCsv(guard.gym_profile_id, currency);

  if (!stream) return jsonError("not_configured", "Database not configured.");

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
