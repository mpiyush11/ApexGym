"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PLAN_DURATION_KEYS, type PlanDurationKey } from "@/lib/domain/constants";
import { toMajor } from "@/lib/money/money";
import { useCreatePlan, useUpdatePlan } from "./usePlans";
import type { MembershipPlan } from "@/lib/domain/types";
import { ApiError } from "@/lib/services/apiClient";

const durationOptions = [
  { value: PLAN_DURATION_KEYS.MONTHLY, label: "Monthly (30 days)" },
  { value: PLAN_DURATION_KEYS.QUARTERLY, label: "Quarterly (90 days)" },
  { value: PLAN_DURATION_KEYS.SEMI_ANNUAL, label: "Semi-annual (180 days)" },
  { value: PLAN_DURATION_KEYS.ANNUAL, label: "Annual (365 days)" },
];

export function PlanFormSheet({
  open,
  onClose,
  editing,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  editing: MembershipPlan | null;
  currency: string;
}) {
  // Body mounts fresh on each open (and per edited plan) so state initializes
  // from props without a syncing effect.
  const formKey = `${open ? "open" : "closed"}:${editing?.plan_id ?? "new"}`;
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit plan" : "New plan"}>
      <PlanFormBody
        key={formKey}
        editing={editing}
        currency={currency}
        onDone={onClose}
      />
    </Sheet>
  );
}

function PlanFormBody({
  editing,
  currency,
  onDone,
}: {
  editing: MembershipPlan | null;
  currency: string;
  onDone: () => void;
}) {
  const create = useCreatePlan();
  const update = useUpdatePlan();

  const [name, setName] = useState(editing?.plan_display_name ?? "");
  const [duration, setDuration] = useState<string>(
    editing?.plan_duration_key ?? PLAN_DURATION_KEYS.MONTHLY,
  );
  const [price, setPrice] = useState(
    editing ? String(toMajor(editing.price_amount_minor, currency)) : "",
  );
  const [joining, setJoining] = useState(
    editing ? String(toMajor(editing.joining_fee_minor, currency)) : "",
  );
  const [desc, setDesc] = useState(editing?.plan_description ?? "");
  const [active, setActive] = useState(editing?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const busy = create.isPending || update.isPending;

  async function handleSave() {
    setError(null);
    const input = {
      plan_display_name: name.trim(),
      plan_duration_key: duration as PlanDurationKey,
      price_major: Number(price) || 0,
      joining_fee_major: Number(joining) || 0,
      plan_description: desc.trim(),
      is_active: active,
      display_order: editing?.display_order ?? 0,
    };
    try {
      if (editing) await update.mutateAsync({ plan_id: editing.plan_id, input });
      else await create.mutateAsync(input);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the plan.");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <Input label="Plan name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly" />
        <Select
          label="Duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          options={durationOptions}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Price (${currency})`}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="3200"
          />
          <Input
            label={`Joining fee (${currency})`}
            inputMode="decimal"
            value={joining}
            onChange={(e) => setJoining(e.target.value)}
            placeholder="1000"
            hint="One-time"
          />
        </div>
        <Textarea label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's included…" />
        <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-3 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand)]"
          />
          <span className="text-sm">Active (shown on public site & renewals)</span>
        </label>
        {error ? (
          <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-5">
        <Button className="w-full" size="lg" onClick={handleSave} isLoading={busy}>
          {editing ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </>
  );
}
