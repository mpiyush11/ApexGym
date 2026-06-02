/** /api/content/[kind]/[id] — owner-only CMS update/delete. */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { schemaFor } from "@/lib/services/content.schema";
import { updateContent, deleteContent, type ContentKind } from "@/lib/services/content.service";
import { httpStatusForError } from "@/lib/utils/result";

const VALID: ContentKind[] = ["trainers", "gallery", "testimonials"];
const parseKind = (k: string): ContentKind | null =>
  (VALID as string[]).includes(k) ? (k as ContentKind) : null;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { kind, id } = await params;
  const k = parseKind(kind);
  const schema = k ? schemaFor(k) : null;
  if (!k || !schema) return NextResponse.json({ error: { code: "not_found", message: "Unknown content type." } }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = schema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await updateContent(guard.gym_profile_id, k, id, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { kind, id } = await params;
  const k = parseKind(kind);
  if (!k) return NextResponse.json({ error: { code: "not_found", message: "Unknown content type." } }, { status: 404 });

  const res = await deleteContent(guard.gym_profile_id, k, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: { ok: true } });
}
