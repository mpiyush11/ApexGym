/**
 * POST /api/onboarding — create a gym tenant for the signed-in user.
 * Thin handler: verify session -> validate -> call service -> shape response.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session.server";
import { onboardingSchema } from "@/lib/services/onboarding.schema";
import { createTenantForUser } from "@/lib/services/onboarding.service";
import { httpStatusForError } from "@/lib/utils/result";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Please sign in first." } },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = onboardingSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: first?.message ?? "Invalid input.",
        },
      },
      { status: 422 },
    );
  }

  const result = await createTenantForUser(user.uid, user.email, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: httpStatusForError(result.error.code) },
    );
  }

  return NextResponse.json({ data: result.data });
}
