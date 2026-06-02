/**
 * Thin client-side API helper. UI never calls fetch directly; modules expose
 * typed services that use this. Normalizes the { data | error } envelope and
 * never throws on network issues without a clear message (env-safety).
 */
"use client";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("network", "Network error. Please check your connection.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const envelope = body as { data?: T; error?: { code: string; message: string } } | null;
  if (!res.ok || envelope?.error) {
    throw new ApiError(
      envelope?.error?.code ?? "internal",
      envelope?.error?.message ?? "Something went wrong.",
    );
  }
  return envelope?.data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(data) }),
  patch: <T>(url: string, data: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(data) }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
