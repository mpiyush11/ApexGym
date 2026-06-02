"use client";

import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

/**
 * Floating Action Button — primary "add" action, thumb-reachable on mobile.
 * Sits above the bottom nav. On desktop it can be hidden in favor of a header
 * button, but we keep it visible and bottom-right for consistency.
 */
export function Fab({
  onClick,
  label,
  icon = "＋",
  className,
}: {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-contrast shadow-[var(--shadow-md)]",
        "transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        // Above mobile bottom nav; normal bottom on desktop.
        "bottom-20 lg:bottom-6",
        className,
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
