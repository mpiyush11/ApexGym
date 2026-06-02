/** /api/content/[kind] — owner-only CMS list/create (trainers|gallery|testimonials). */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/guard.server";
import { schemaFor } from "@/lib/services/content.schema";
import { listContent, createContent, type ContentKind } from "@/lib/services/content.service";
import { httpStatusForError } from "@/lib/utils/result";

const VALID: ContentKind[] = ["trainers", "gallery", "testimonials"];

function parseKind(kind: string): ContentKind | null {
  return (VALID as string[]).includes(kind) ? (kind as ContentKind) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { kind } = await params;
  const k = parseKind(kind);
  if (!k) return NextResponse.json({ error: { code: "not_found", message: "Unknown content type." } }, { status: 404 });

  const res = await listContent(guard.gym_profile_id, k);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: httpStatusForError(guard.code) });
  }
  const { kind } = await params;
  const k = parseKind(kind);
  const schema = k ? schemaFor(k) : null;
  if (!k || !schema) return NextResponse.json({ error: { code: "not_found", message: "Unknown content type." } }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const res = await createContent(guard.gym_profile_id, k, parsed.data);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  return NextResponse.json({ data: res.data });
}
