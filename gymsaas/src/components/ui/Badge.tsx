import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";
import type { MemberStatusKey } from "@/lib/domain/constants";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-surface-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  brand: "bg-brand/15 text-brand border-brand/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<MemberStatusKey, Tone> = {
  active: "success",
  expiring_soon: "warning",
  expired: "danger",
  inactive: "neutral",
};

const statusLabel: Record<MemberStatusKey, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  inactive: "Inactive",
};

export function MemberStatusBadge({ status }: { status: MemberStatusKey }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}
