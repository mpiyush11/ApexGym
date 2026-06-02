import { cn } from "@/lib/utils/cn";
import type {
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

const baseControl =
  "w-full rounded-[var(--radius-card)] border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";

function Wrapper({
  label,
  error,
  hint,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? <label className="block text-sm font-medium">{label}</label> : null}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, hint, options, className, ...rest }: SelectProps) {
  return (
    <Wrapper label={label} error={error} hint={hint}>
      <select
        className={cn(baseControl, "h-11", error ? "border-danger/60" : "border-surface-border", className)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, ...rest }: TextareaProps) {
  return (
    <Wrapper label={label} error={error} hint={hint}>
      <textarea
        className={cn(baseControl, "min-h-[88px] py-2.5", error ? "border-danger/60" : "border-surface-border", className)}
        {...rest}
      />
    </Wrapper>
  );
}
