"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { LEAD_STATUS_KEYS, type LeadStatusKey } from "@/lib/domain/constants";
import type { Lead } from "@/lib/domain/types";

const statusOptions = [
  { value: LEAD_STATUS_KEYS.NEW, label: "New" },
  { value: LEAD_STATUS_KEYS.CONTACTED, label: "Contacted" },
  { value: LEAD_STATUS_KEYS.TRIAL, label: "Trial" },
  { value: LEAD_STATUS_KEYS.CONVERTED, label: "Converted" },
  { value: LEAD_STATUS_KEYS.LOST, label: "Lost" },
];

const tone: Record<LeadStatusKey, "info" | "warning" | "brand" | "success" | "neutral"> = {
  new: "info",
  contacted: "warning",
  trial: "brand",
  converted: "success",
  lost: "neutral",
};

const sourceLabel: Record<string, string> = {
  public_contact_form: "Website",
  walk_in: "Walk-in",
  manual: "Manual",
};

/** Mobile-first lead card with one-tap WhatsApp / Call and inline status. */
export function LeadCard({
  lead,
  whatsappTemplate,
  gymName,
  onStatusChange,
  isUpdating,
}: {
  lead: Lead;
  whatsappTemplate: string;
  gymName: string;
  onStatusChange: (status: LeadStatusKey) => void;
  isUpdating: boolean;
}) {
  const phoneDigits = (lead.lead_phone ?? "").replace(/[^0-9]/g, "");
  const waText = encodeURIComponent(
    whatsappTemplate
      .replace("{member_display_name}", lead.lead_display_name)
      .replace("{gym_display_name}", gymName)
      .replace("{membership_end_date}", ""),
  );
  const waHref = phoneDigits ? `https://wa.me/${phoneDigits}?text=${waText}` : null;
  const telHref = phoneDigits ? `tel:${lead.lead_phone}` : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{lead.lead_display_name}</p>
          <p className="truncate text-xs text-muted">{lead.lead_phone || "No phone"}</p>
        </div>
        <Badge tone={tone[lead.lead_status_key]}>{lead.lead_status_key}</Badge>
      </div>

      {lead.lead_message ? (
        <p className="mt-2 line-clamp-3 text-sm text-muted">{lead.lead_message}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span className="rounded-full bg-surface-2 px-2 py-0.5">
          {sourceLabel[lead.lead_source_key] ?? lead.lead_source_key}
        </span>
        <span>{fmt(lead.created_at)}</span>
      </div>

      {/* Quick actions — thumb-reachable */}
      <div className="mt-3 flex gap-2">
        {waHref ? (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button className="w-full" size="sm">💬 WhatsApp</Button>
          </a>
        ) : (
          <Button className="flex-1" size="sm" disabled title="No phone number">💬 WhatsApp</Button>
        )}
        {telHref ? (
          <a href={telHref} className="flex-1">
            <Button variant="secondary" className="w-full" size="sm">📞 Call</Button>
          </a>
        ) : null}
      </div>

      <div className="mt-3">
        <Select
          aria-label="Lead status"
          value={lead.lead_status_key}
          onChange={(e) => onStatusChange(e.target.value as LeadStatusKey)}
          options={statusOptions}
          disabled={isUpdating}
        />
      </div>
    </Card>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}
