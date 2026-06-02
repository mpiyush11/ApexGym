"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useAnalytics, useRebuildAnalytics } from "@/modules/analytics/useAnalytics";
import { BarChart, type BarDatum } from "@/modules/analytics/BarChart";
import { formatMoney, toMajor } from "@/lib/money/money";
import { monthShortLabel } from "@/lib/domain/analytics.logic";

export default function AnalyticsPage() {
  const session = useAppSession();
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError, refetch } = useAnalytics(months);
  const rebuild = useRebuildAnalytics();
  const currency = data?.currency_code ?? "INR";

  const revenueBars: BarDatum[] =
    data?.months.map((m) => ({
      label: monthShortLabel(m.month_key),
      value: m.revenue_collected_minor,
      display: formatMoney(m.revenue_collected_minor, currency),
    })) ?? [];

  const joinsBars: BarDatum[] =
    data?.months.map((m) => ({
      label: monthShortLabel(m.month_key),
      value: m.new_joins_count,
      display: `${m.new_joins_count} joins`,
    })) ?? [];

  return (
    <AppShell role={session.role} title="Analytics">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to see live analytics.
        </div>
      )}

      {/* Window selector — thumb-friendly segmented control */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-[var(--radius-card)] border border-surface-border bg-surface p-1">
          {[3, 6, 12].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setMonths(w)}
              className={`h-9 rounded-[calc(var(--radius-card)-2px)] px-3 text-sm font-medium transition-colors ${
                months === w ? "bg-brand text-brand-contrast" : "text-muted"
              }`}
            >
              {w}m
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => rebuild.mutate()}
          isLoading={rebuild.isPending}
        >
          ↻ Rebuild
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5"><Skeleton className="h-8 w-2/3" /></Card>
            ))}
          </div>
          <Card className="p-5"><Skeleton className="h-40 w-full" /></Card>
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data ? (
        <div className="space-y-4">
          {/* KPI grid: 2-up mobile, 4-up desktop */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={`Revenue (${months}m)`}
              value={formatMoney(data.total_revenue_minor, currency)}
              tone="brand"
              icon="₹"
            />
            <StatCard label="New joins" value={data.total_new_joins} tone="success" icon="🆕" />
            <StatCard label="Renewal rate" value={`${data.renewal_rate_pct}%`} tone="info" icon="🔁" />
            <StatCard label="Active members" value={data.active_count} tone="success" icon="🟢" />
          </div>

          <Card>
            <CardHeader title="Revenue by month" subtitle={`Collected · last ${months} months`} />
            <CardBody>
              {revenueBars.every((b) => b.value === 0) ? (
                <p className="py-6 text-center text-sm text-muted">No revenue recorded yet.</p>
              ) : (
                <BarChart data={revenueBars} tone="brand" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="New joins by month" />
            <CardBody>
              {joinsBars.every((b) => b.value === 0) ? (
                <p className="py-6 text-center text-sm text-muted">No joins recorded yet.</p>
              ) : (
                <BarChart data={joinsBars} tone="success" />
              )}
            </CardBody>
          </Card>

          {/* Membership status snapshot */}
          <Card>
            <CardHeader title="Membership status" subtitle={`${data.total_members} total members`} />
            <CardBody>
              <div className="grid grid-cols-3 gap-3 text-center">
                <StatusPill label="Active" value={data.active_count} tone="text-success" />
                <StatusPill label="Expiring" value={data.expiring_count} tone="text-warning" />
                <StatusPill label="Expired" value={data.expired_count} tone="text-danger" />
              </div>
            </CardBody>
          </Card>

          <p className="px-1 text-[11px] text-muted">
            All figures are derived from immutable membership &amp; payment records.
            {data.months.length > 0
              ? ` Avg/month: ${formatMoney(Math.round(data.total_revenue_minor / data.months.length), currency)} (${toMajor(0, currency) >= 0 ? "" : ""}collected).`
              : ""}
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-surface-border bg-surface-2 py-3">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
