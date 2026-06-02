"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MemberStatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { formatMoney } from "@/lib/money/money";
import { appConfig } from "@/lib/config/env";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useDashboardSummary, useRecomputeStatuses } from "@/modules/dashboard/useDashboard";
import { useExpiringMembers } from "@/modules/renewals/useRenewals";
import { RenewSheet } from "@/modules/renewals/RenewSheet";
import type { Member } from "@/lib/domain/types";

export default function DashboardPage() {
  const session = useAppSession();
  const currency = appConfig.defaultCurrency;
  const summary = useDashboardSummary();
  const expiring = useExpiringMembers();
  const recompute = useRecomputeStatuses();
  const [renewing, setRenewing] = useState<Member | null>(null);

  const s = summary.data;

  return (
    <AppShell role={session.role} title="Dashboard">
      {session.previewMode && (
        <div className="mb-5 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to see live data.
        </div>
      )}

      {/* Stat grid: mobile 2-up, desktop 4-up */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-2/3" /></Card>
          ))
        ) : summary.isError ? (
          <div className="col-span-2 lg:col-span-4"><ErrorState onRetry={() => summary.refetch()} /></div>
        ) : (
          <>
            <StatCard label="Active members" value={s?.active_count ?? 0} tone="success" icon="🟢" />
            <StatCard label="Expiring soon" value={s?.expiring_count ?? 0} tone="warning" icon="⏳" />
            <StatCard label="Expired" value={s?.expired_count ?? 0} tone="danger" icon="⛔" />
            {/* Revenue is owner-only (server strips it for reception). */}
            {s?.can_view_revenue ? (
              <StatCard
                label="Revenue (this month)"
                value={formatMoney(s?.revenue_month_minor ?? 0, s?.currency_code ?? currency)}
                tone="brand"
                icon="₹"
              />
            ) : (
              <StatCard label="Total members" value={s?.total_members ?? 0} tone="brand" icon="👥" />
            )}
            {/* Leads integrate into the dashboard — tap through to the pipeline. */}
            <Link href="/app/leads" className="col-span-2 lg:col-span-4">
              <StatCard label="New leads" value={s?.lead_new_count ?? 0} tone="info" icon="📥" hint="Tap to view pipeline →" />
            </Link>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted">
          {s ? `${s.total_members} total members` : "\u00A0"}
        </p>
        {session.role === "owner" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => recompute.mutate()}
            isLoading={recompute.isPending}
          >
            ↻ Refresh statuses
          </Button>
        )}
      </div>

      {/* Expiring worklist with one-tap renew */}
      <div className="mt-2">
        <Card>
          <CardHeader title="Expiring & expired" subtitle="Renew in one tap before they lapse" />
          <CardBody>
            {expiring.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : expiring.isError ? (
              <ErrorState onRetry={() => expiring.refetch()} />
            ) : !expiring.data || expiring.data.length === 0 ? (
              <EmptyState title="All caught up 🎉" description="No memberships need attention." />
            ) : (
              <ul className="divide-y divide-surface-border">
                {expiring.data.slice(0, 8).map((m) => (
                  <li key={m.member_id} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-brand">
                      {m.member_display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.member_display_name}</p>
                      <p className="truncate text-xs text-muted">{m.member_code}</p>
                    </div>
                    <MemberStatusBadge status={m.member_status_key} />
                    <Button size="sm" className="shrink-0" onClick={() => setRenewing(m)}>
                      Renew
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <RenewSheet
        open={Boolean(renewing)}
        onClose={() => setRenewing(null)}
        member={renewing}
        currency={currency}
      />
    </AppShell>
  );
}
