"use client";

import { useMembershipHistory } from "@/modules/renewals/useRenewals";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money/money";

/**
 * Immutable renewal history timeline for a member (read-only).
 * Each row is a past membership period with its SNAPSHOT pricing — these never
 * change even if the plan is later edited.
 */
export function MembershipHistory({
  member_id,
  currency,
}: {
  member_id: string;
  currency: string;
}) {
  const { data, isLoading, isError } = useMembershipHistory(member_id);

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (isError) {
    return <p className="text-sm text-muted">Could not load history.</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted">No renewals yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {data.map((ms) => (
        <li
          key={ms.membership_id}
          className="rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{ms.plan_name_snapshot}</span>
            <span className="text-sm font-semibold text-brand">
              {formatMoney(ms.amount_paid_minor, ms.currency_code || currency)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span>{fmt(ms.membership_start_date)} → {fmt(ms.membership_end_date)}</span>
            <PaymentBadge status={ms.payment_status_key} />
            <span className="uppercase">{ms.payment_method_key}</span>
            {ms.amount_due_minor > 0 ? (
              <span className="text-danger">
                Due {formatMoney(ms.amount_due_minor, ms.currency_code || currency)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge tone="success">Paid</Badge>;
  if (status === "partial") return <Badge tone="warning">Partial</Badge>;
  return <Badge tone="danger">Pending</Badge>;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso.slice(0, 10);
  }
}
