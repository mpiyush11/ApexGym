"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MemberStatusBadge } from "@/components/ui/Badge";
import { SkeletonCardList } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useExpiringMembers } from "@/modules/renewals/useRenewals";
import { RenewSheet } from "@/modules/renewals/RenewSheet";
import { appConfig } from "@/lib/config/env";
import type { Member } from "@/lib/domain/types";

export default function RenewalsPage() {
  const session = useAppSession();
  const { data, isLoading, isError, refetch } = useExpiringMembers();
  const [renewing, setRenewing] = useState<Member | null>(null);
  const currency = appConfig.defaultCurrency;

  return (
    <AppShell role={session.role} title="Renewals">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to see live renewals.
        </div>
      )}

      <p className="mb-4 text-sm text-muted">
        Members expiring soon or already expired — renew in one tap before they lapse.
      </p>

      {isLoading ? (
        <SkeletonCardList rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nothing to renew 🎉" description="No expiring or expired memberships right now." icon="✅" />
      ) : (
        <div className="space-y-3">
          {data.map((m) => {
            const end = m.current_membership_summary?.membership_end_date;
            return (
              <Card key={m.member_id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-semibold text-brand">
                    {m.member_display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.member_display_name}</p>
                    <p className="truncate text-xs text-muted">
                      {m.member_code} • {m.member_phone}
                    </p>
                    {end ? (
                      <p className="mt-0.5 text-[11px] text-muted">Ends {fmt(end)}</p>
                    ) : null}
                  </div>
                  <MemberStatusBadge status={m.member_status_key} />
                </div>
                <Button className="mt-3 w-full" onClick={() => setRenewing(m)}>
                  Renew now
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <RenewSheet
        open={Boolean(renewing)}
        onClose={() => setRenewing(null)}
        member={renewing}
        currency={currency}
      />
    </AppShell>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
