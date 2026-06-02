import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Labeled input — 44px height (mobile tap target), clear error state. */
export function Input({ label, hint, error, className, id, ...rest }: FieldProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-[var(--radius-card)] border bg-surface-2 px-3 text-sm text-foreground",
          "placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          error ? "border-danger/60" : "border-surface-border",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
