"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Fab } from "@/components/ui/Fab";
import { SkeletonCardList } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { formatMoney } from "@/lib/money/money";
import { appConfig } from "@/lib/config/env";
import { usePlans, useDeactivatePlan } from "@/modules/plans/usePlans";
import { PlanFormSheet } from "@/modules/plans/PlanFormSheet";
import type { MembershipPlan } from "@/lib/domain/types";

const durationLabel: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

export default function PlansPage() {
  const session = useAppSession();
  const isOwner = session.role === "owner";
  const { data: plans, isLoading, isError, refetch } = usePlans();
  const deactivate = useDeactivatePlan();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [confirm, setConfirm] = useState<MembershipPlan | null>(null);
  const currency = appConfig.defaultCurrency;

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(p: MembershipPlan) {
    setEditing(p);
    setSheetOpen(true);
  }

  return (
    <AppShell role={session.role} title="Membership Plans">
      {session.previewMode && (
        <PreviewBanner />
      )}

      {isLoading ? (
        <SkeletonCardList rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !plans || plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description={isOwner ? "Create your first membership plan to start enrolling members." : "Ask the owner to add membership plans."}
          icon="🏷️"
          action={isOwner ? <Button onClick={openNew}>Create plan</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.plan_id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{p.plan_display_name}</h3>
                    {!p.is_active && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {durationLabel[p.plan_duration_key]} • {p.plan_duration_days} days
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-brand">
                    {formatMoney(p.price_amount_minor, p.currency_code || currency)}
                  </p>
                  {p.joining_fee_minor > 0 && (
                    <p className="text-[11px] text-muted">
                      + {formatMoney(p.joining_fee_minor, p.currency_code || currency)} joining
                    </p>
                  )}
                </div>
              </div>
              {p.plan_description ? (
                <p className="mt-3 line-clamp-2 text-sm text-muted">{p.plan_description}</p>
              ) : null}
              {isOwner && (
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  {p.is_active && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(p)}>
                      Deactivate
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {isOwner && <Fab onClick={openNew} label="Add plan" />}

      <PlanFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editing={editing}
        currency={currency}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Deactivate plan?"
        description={`"${confirm?.plan_display_name}" will be hidden from new sign-ups and the public site. Existing member history is preserved.`}
        confirmLabel="Deactivate"
        destructive
        isLoading={deactivate.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) await deactivate.mutateAsync(confirm.plan_id);
          setConfirm(null);
        }}
      />
    </AppShell>
  );
}

function PreviewBanner() {
  return (
    <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
      <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to manage live plans.
    </div>
  );
}
