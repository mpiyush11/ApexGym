"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonCardList } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useLeads, useSetLeadStatus } from "@/modules/leads/useLeads";
import { LeadCard } from "@/modules/leads/LeadCard";
import { LEAD_STATUS_KEYS, type LeadStatusKey } from "@/lib/domain/constants";

type Filter = LeadStatusKey | "all";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: LEAD_STATUS_KEYS.NEW, label: "New" },
  { key: LEAD_STATUS_KEYS.CONTACTED, label: "Contacted" },
  { key: LEAD_STATUS_KEYS.TRIAL, label: "Trial" },
  { key: LEAD_STATUS_KEYS.CONVERTED, label: "Converted" },
  { key: LEAD_STATUS_KEYS.LOST, label: "Lost" },
];

const DEFAULT_WA_TEMPLATE =
  "Hi {member_display_name}, thanks for your interest in {gym_display_name}! How can we help you get started?";

export default function LeadsPage() {
  const session = useAppSession();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, isError, refetch } = useLeads(filter);
  const setStatus = useSetLeadStatus();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function changeStatus(lead_id: string, lead_status_key: LeadStatusKey) {
    setUpdatingId(lead_id);
    try {
      await setStatus.mutateAsync({ lead_id, lead_status_key });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AppShell role={session.role} title="Leads">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to see live leads.
        </div>
      )}

      {/* Filter chips — horizontally scrollable on 360px, no wrap/overflow issues */}
      <div className="sticky top-16 z-10 -mx-4 mb-4 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "border-brand bg-brand text-brand-contrast"
                  : "border-surface-border bg-surface text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonCardList rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No leads yet" : "No leads in this stage"}
          description="New enquiries from your website contact form will appear here."
          icon="📥"
        />
      ) : (
        <div className="space-y-3">
          {data.map((lead) => (
            <LeadCard
              key={lead.lead_id}
              lead={lead}
              gymName="our gym"
              whatsappTemplate={DEFAULT_WA_TEMPLATE}
              isUpdating={updatingId === lead.lead_id}
              onStatusChange={(s) => changeStatus(lead.lead_id, s)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
