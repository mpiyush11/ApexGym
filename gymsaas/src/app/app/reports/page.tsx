"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useReports, useGenerateReport } from "@/modules/reports/useReports";
import { formatMoney } from "@/lib/money/money";
import { appConfig } from "@/lib/config/env";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function ReportsPage() {
  const session = useAppSession();

  if (session.role !== "owner" && !session.previewMode) {
    return (
      <AppShell role={session.role} title="Reports">
        <EmptyState title="Owner only" description="Only the gym owner can view reports & exports." icon="🔒" />
      </AppShell>
    );
  }

  return <ReportsContent />;
}

function ReportsContent() {
  const session = useAppSession();
  const { data, isLoading, isError, refetch } = useReports();
  const generate = useGenerateReport();
  const currency = appConfig.defaultCurrency;
  const latest = data?.[0];

  return (
    <AppShell role={session.role} title="Reports">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to generate live reports.
        </div>
      )}

      {/* Latest weekly summary */}
      <Card>
        <CardHeader
          title="This week"
          subtitle={latest ? `Week ending ${fmt(latest.report_period_end)}` : "No report yet"}
          action={
            <Button size="sm" onClick={() => generate.mutate()} isLoading={generate.isPending}>
              Generate now
            </Button>
          }
        />
        <CardBody>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !latest ? (
            <EmptyState title="No report yet" description="Tap “Generate now” to build this week’s summary." icon="📄" />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Revenue (7d)" value={formatMoney(latest.revenue_period_minor, currency)} tone="brand" icon="₹" />
              <StatCard label="New joins" value={latest.new_joins} tone="success" icon="🆕" />
              <StatCard label="Renewals" value={latest.renewals ?? Math.max(0, (latest.periods_count ?? 0) - latest.new_joins)} tone="info" icon="🔁" />
              <StatCard label="Expiring" value={latest.expiring_count} tone="warning" icon="⏳" />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Exports */}
      <div className="mt-5">
        <Card>
          <CardHeader title="Export your data" subtitle="Download as CSV (opens in Excel / Sheets)" />
          <CardBody>
            <div className="space-y-2">
              {/* File-download API endpoints (not page routes): plain anchors. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/reports/export/members" className="flex items-center justify-between rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-4 py-3 text-sm font-medium">
                <span>👥 Members</span><span className="text-brand">Download CSV ↓</span>
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/reports/export/payments" className="flex items-center justify-between rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-4 py-3 text-sm font-medium">
                <span>💳 Payments &amp; renewals</span><span className="text-brand">Download CSV ↓</span>
              </a>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Exports reflect your live records. Payments come from immutable membership history.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* History */}
      <div className="mt-5">
        <Card>
          <CardHeader title="Report history" />
          <CardBody>
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : !data || data.length === 0 ? (
              <EmptyState title="No reports yet" description="Generated weekly summaries appear here." icon="🗂️" />
            ) : (
              <ul className="divide-y divide-surface-border">
                {data.map((r) => (
                  <li key={r.report_run_id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">Week ending {fmt(r.report_period_end)}</p>
                      <p className="truncate text-xs text-muted">
                        {r.new_joins} joins · {formatMoney(r.revenue_period_minor, currency)} · {r.lead_new} leads
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
