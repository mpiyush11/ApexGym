"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { getAppCheckTokenSafely } from "@/lib/firebase/client";

/**
 * Public contact form (client). Branded with the REAL gym (name, brand colour,
 * WhatsApp) so a visitor never feels they left the gym's site — a key trust /
 * conversion element. WhatsApp-first: offers a chat option alongside the form.
 */
export function ContactForm({
  gymSlug,
  gymName,
  brand,
  whatsappLink,
}: {
  gymSlug: string;
  gymName: string;
  brand: string;
  whatsappLink: string | null;
}) {
  const [renderedAt] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    try {
      const appCheckToken = await getAppCheckTokenSafely();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;

      const res = await fetch(`/api/public/${gymSlug}/contact`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          lead_display_name: name.trim(),
          lead_phone: phone.trim(),
          lead_email: email.trim(),
          lead_message: message.trim(),
          company_website: honeypot,
          form_rendered_at: renderedAt,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not send your enquiry. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10" style={{ ["--brand" as string]: brand }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: `radial-gradient(50% 40% at 50% 0%, ${brand}30, transparent 70%)` }}
      />
      <div className="relative w-full max-w-md">
        {/* Branded with the GYM (not the platform) for trust/continuity. */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🏋️</span>
            <span className="text-xl font-bold tracking-tight">{gymName}</span>
          </div>
          <Link href={`/g/${gymSlug}`} className="mt-1 inline-block text-xs text-muted hover:text-foreground">
            ← Back to site
          </Link>
        </div>

        <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-6 shadow-[var(--shadow-md)] sm:p-8">
          {status === "success" ? (
            <div className="py-6 text-center">
              <div className="mb-3 text-4xl">✅</div>
              <h1 className="text-xl font-semibold">Enquiry sent!</h1>
              <p className="mt-2 text-sm text-muted">
                Thanks{name ? `, ${name.split(" ")[0]}` : ""}! {gymName} will reach out to you soon.
              </p>
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] px-6 font-semibold text-black"
                  style={{ background: brand }}
                >
                  💬 Chat on WhatsApp now
                </a>
              ) : null}
              <Link href={`/g/${gymSlug}`} className="mt-3 block text-sm text-muted hover:text-foreground">
                Back to {gymName}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Enquire at {gymName}</h1>
              <p className="mt-1 text-sm text-muted">
                Leave your details and the team will contact you about membership.
              </p>

              {/* WhatsApp-first: offer instant chat above the form. */}
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] px-6 font-semibold text-black"
                  style={{ background: brand }}
                >
                  💬 Chat on WhatsApp
                </a>
              ) : null}
              {whatsappLink ? (
                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted">
                  <span className="h-px flex-1 bg-surface-border" /> or fill the form <span className="h-px flex-1 bg-surface-border" />
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-2 space-y-4">
                <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Your full name" />
                <Input label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" placeholder="+91 90000 00000" />
                <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@email.com" />
                <Textarea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="I'd like to know about your plans…" />

                {/* Honeypot — off-screen, not focusable */}
                <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Company website
                    <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </label>
                </div>

                {status === "error" && error ? (
                  <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
                ) : null}

                <Button type="submit" size="lg" className="w-full" isLoading={status === "submitting"}>
                  Send enquiry
                </Button>
                <p className="text-center text-[11px] text-muted">
                  We respect your privacy. Your details are only shared with {gymName}.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
