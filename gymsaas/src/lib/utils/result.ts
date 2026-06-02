/**
 * Result type for services — explicit success/failure without throwing.
 * Keeps API handlers thin and predictable (env-safety: no surprise crashes).
 */
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: { code: string; message: string } };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(code: string, message: string): Err {
  return { ok: false, error: { code, message } };
}

/** Standard HTTP status mapping for common error codes. */
export const ERROR_HTTP_STATUS: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  suspended: 403,
  rate_limited: 429,
  not_configured: 503,
  internal: 500,
};

export function httpStatusForError(code: string): number {
  return ERROR_HTTP_STATUS[code] ?? 400;
}
