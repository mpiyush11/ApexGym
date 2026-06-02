import Link from "next/link";
import { appConfig } from "@/lib/config/env";

/**
 * Marketing/landing root. (The per-tenant luxury public site by gym_slug
 * arrives in milestone M7.) This is an M0 placeholder establishing the
 * premium look and pointing into the demo dashboard.
 */
export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(212,175,55,0.25), transparent 70%)",
          }}
        />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 py-20 text-center sm:py-28">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3 py-1 text-xs font-medium text-brand">
            🏋️ {appConfig.appName} • Gym Management SaaS
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Run your gym, not{" "}
            <span className="text-brand">spreadsheets.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted sm:text-lg">
            A premium, mobile-first platform for independent gyms: members,
            plans, one-tap renewals, expiry tracking, leads, digital member
            cards and automated reports — without the enterprise bloat.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] bg-brand px-6 font-semibold text-brand-contrast transition-colors hover:bg-brand-strong"
            >
              View demo dashboard →
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-card)] border border-surface-border bg-surface px-6 font-semibold text-foreground transition-colors hover:bg-surface-2"
            >
              Explore features
            </a>
          </div>
        </div>
      </section>

      {/* Features grid: mobile 1-up, tablet 2-up, desktop 3-up */}
      <section id="features" className="mx-auto max-w-5xl px-5 pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["🧑‍🤝‍🧑", "Member management", "Add, edit, search and track members from any phone."],
            ["🔁", "One-tap renewals", "Renew memberships instantly with cash or UPI."],
            ["⏳", "Expiry tracking", "Automatic expiry calculation and soft reminders."],
            ["📥", "Lead management", "Capture website leads and convert them on WhatsApp."],
            ["🪪", "Digital member cards", "Shareable, always-live identity cards — no app needed."],
            ["📄", "Automated reports", "Weekly summaries exported and delivered for you."],
          ].map(([icon, title, desc]) => (
            <div
              key={title}
              className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-5"
            >
              <div className="text-2xl">{icon}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-surface-border py-8 text-center text-sm text-muted">
        {appConfig.appName} • Built mobile-first • V1
      </footer>
    </main>
  );
}
