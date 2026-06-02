import type { ReactNode } from "react";
import { appConfig } from "@/lib/config/env";

/** Centered, premium auth shell — mobile-first single column. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 0%, rgba(212,175,55,0.22), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">🏋️</span>
          <span className="text-xl font-bold tracking-tight">
            {appConfig.appName}
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-6 shadow-[var(--shadow-md)] sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-4 text-center text-sm text-muted">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
