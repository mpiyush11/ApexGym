import { Button } from "@/components/ui/Button";

/** Standard error surface — never leave a blank screen or infinite spinner. */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem persists, check your connection.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <div className="mb-2 text-2xl">⚠️</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Shown when Firebase / required config is missing — graceful degradation. */
export function ConfigNeededState({
  what = "Firebase",
}: {
  what?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-6 py-10 text-center">
      <div className="mb-2 text-2xl">🔧</div>
      <h3 className="text-base font-semibold text-foreground">
        {what} is not configured yet
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted">
        Add the required environment variables (see{" "}
        <code className="rounded bg-surface-2 px-1">.env.example</code>) and reload.
        The app stays usable and will connect automatically once configured.
      </p>
    </div>
  );
}
