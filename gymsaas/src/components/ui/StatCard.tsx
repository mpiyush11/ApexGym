import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

/** Dashboard metric card. Mobile-first: 2-up on phones, 4-up on desktop. */
export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
}) {
  const toneColor: Record<string, string> = {
    brand: "text-brand",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  };
  return (
    <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        {icon ? <span className={cn("text-lg", toneColor[tone])}>{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums sm:text-3xl", toneColor[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
