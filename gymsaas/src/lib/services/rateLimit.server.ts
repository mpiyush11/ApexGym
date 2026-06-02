/**
 * Durable fixed-window rate limiter (server-only).
 *
 * JUSTIFICATION (constraint #5 + #3): serverless functions are stateless, so an
 * in-memory limiter does not work. We keep a tiny top-level collection
 * `public_rate_limits/{key}` where each doc is one counter window. The catch-all
 * Security Rule already DENIES all client access to this collection (admin-only),
 * so no rules change is needed.
 *
 * Cost: 1 transactional read+write per public submit attempt — far cheaper than
 * the spam/abuse it prevents. Windows are short-lived; an external TTL policy on
 * `expires_at` can reclaim them (optional, no background job required for V1).
 */
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/paths";

const RATE_LIMIT_COLLECTION = "public_rate_limits";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * @param key      unique bucket key, e.g. `contact:{gym_profile_id}:{ip}`
 * @param limit    max requests allowed in the window
 * @param windowMs window length in ms
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const db = getAdminDb();
  // If DB is unconfigured we fail OPEN for the limiter but the caller will fail
  // closed elsewhere (no DB = no write). Never throw.
  if (!db) return { allowed: true, remaining: limit };

  const safeKey = key.replace(/[^a-zA-Z0-9:_.-]/g, "_").slice(0, 200);
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(safeKey);
  const now = Date.now();

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() ?? {} : {};
      const windowStart = Number(data.window_start) || 0;
      const count = Number(data.count) || 0;

      // New window?
      if (!snap.exists || now - windowStart >= windowMs) {
        tx.set(ref, {
          window_start: now,
          count: 1,
          expires_at: now + windowMs,
        });
        return { allowed: true, remaining: limit - 1 };
      }

      if (count >= limit) {
        return { allowed: false, remaining: 0 };
      }

      tx.set(ref, { count: FieldValue.increment(1) }, { merge: true });
      return { allowed: true, remaining: limit - count - 1 };
    });
  } catch {
    // On limiter failure, do not block legitimate users; other layers still apply.
    return { allowed: true, remaining: limit };
  }
}

export { RATE_LIMIT_COLLECTION, COLLECTIONS };
