/**
 * POST /api/public/[gym_slug]/contact — UNAUTHENTICATED public lead intake.
 *
 * Spam protection (constraint #5), layered:
 *   1. Honeypot (`company_website`) must be empty — bots fill it.
 *   2. Time trap — form must be on screen >= 2s before submit.
 *   3. Server-side App Check verification (when configured).
 *   4. Durable rate limit — per IP+gym AND per gym/day caps.
 *   5. Zod validation.
 * For honeypot/time-trap hits we return a fake success (don't teach bots).
 *
 * Cost: 1 slug read + 1 rate-limit txn + 1 lead-create txn (counter bump).
 */
import { NextResponse } from "next/server";
import { publicContactSchema } from "@/lib/services/lead.schema";
import { resolveGymBySlug, createPublicLead } from "@/lib/services/lead.service";
import { checkRateLimit } from "@/lib/services/rateLimit.server";
import { verifyAppCheckToken } from "@/lib/firebase/admin";
import { firebaseStatus } from "@/lib/config/env";
import { httpStatusForError } from "@/lib/utils/result";

const MIN_FILL_MS = 2000; // bots submit instantly
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW_MS = 10 * 60 * 1000; // 5 per 10 min per IP
const PER_GYM_DAILY_LIMIT = 100;
const PER_GYM_WINDOW_MS = 24 * 60 * 60 * 1000;

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

const fakeSuccess = () =>
  NextResponse.json({ data: { ok: true } });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gym_slug: string }> },
) {
  const { gym_slug } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = publicContactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid input." } },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // 1. Honeypot — silently accept (looks successful to the bot).
  if (input.company_website && input.company_website.length > 0) {
    return fakeSuccess();
  }
  // 2. Time trap — too fast = bot. Silently accept.
  if (input.form_rendered_at && Date.now() - input.form_rendered_at < MIN_FILL_MS) {
    return fakeSuccess();
  }

  // 2b. App Check verification (only enforced when App Check is configured).
  // env-safe: if no App Check site key is set (dev/preview), we skip enforcement.
  if (firebaseStatus.appCheckConfigured) {
    const token = request.headers.get("x-firebase-appcheck");
    const result = await verifyAppCheckToken(token);
    if (result === "invalid" || result === "missing") {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Request could not be verified." } },
        { status: 403 },
      );
    }
    // "unconfigured" => admin App Check unavailable; fall through (rate limit + traps still apply).
  }

  // Resolve gym (1 read).
  const gym = await resolveGymBySlug(gym_slug);
  if (!gym.ok) {
    return NextResponse.json({ error: gym.error }, { status: httpStatusForError(gym.error.code) });
  }
  // A suspended gym must not capture new leads. Silent accept (don't reveal).
  if (gym.data.is_suspended) {
    return fakeSuccess();
  }

  // 3. Rate limits (per IP, then per gym/day).
  const ip = clientIp(request);
  const ipLimit = await checkRateLimit(
    `contact:${gym.data.gym_profile_id}:${ip}`,
    PER_IP_LIMIT,
    PER_IP_WINDOW_MS,
  );
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests. Please try again later." } },
      { status: 429 },
    );
  }
  const gymLimit = await checkRateLimit(
    `contact-day:${gym.data.gym_profile_id}`,
    PER_GYM_DAILY_LIMIT,
    PER_GYM_WINDOW_MS,
  );
  if (!gymLimit.allowed) {
    // Silently accept to avoid revealing the cap; lead simply isn't stored.
    return fakeSuccess();
  }

  const res = await createPublicLead(gym.data.gym_profile_id, input);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: httpStatusForError(res.error.code) });
  }
  return NextResponse.json({ data: { ok: true } });
}
