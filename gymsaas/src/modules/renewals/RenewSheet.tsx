"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Field";
import { usePlans } from "@/modules/plans/usePlans";
import { useRenewMembership } from "./useRenewals";
import { formatMoney, toMajor } from "@/lib/money/money";
import { PAYMENT_METHOD_KEYS } from "@/lib/domain/constants";
import type { Member, MembershipPlan } from "@/lib/domain/types";
import { ApiError } from "@/lib/services/apiClient";

const methodOptions = [
  { value: PAYMENT_METHOD_KEYS.CASH, label: "Cash" },
  { value: PAYMENT_METHOD_KEYS.UPI, label: "UPI" },
  { value: PAYMENT_METHOD_KEYS.CARD, label: "Card" },
];

export function RenewSheet({
  open,
  onClose,
  member,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  member: Member | null;
  currency: string;
}) {
  const key = `${open ? "o" : "c"}:${member?.member_id ?? "none"}`;
  return (
    <Sheet open={open} onClose={onClose} title={member ? `Renew · ${member.member_display_name}` : "Renew"}>
      {member ? (
        <RenewBody key={key} member={member} currency={currency} onDone={onClose} />
      ) : null}
    </Sheet>
  );
}

function RenewBody({
  member,
  currency,
  onDone,
}: {
  member: Member;
  currency: string;
  onDone: () => void;
}) {
  const { data: plans, isLoading } = usePlans();
  const renew = useRenewMembership();
  const activePlans = (plans ?? []).filter((p) => p.is_active);

  const isFirstJoin = !member.current_membership_summary;
  const [planId, setPlanId] = useState<string>("");
  const [method, setMethod] = useState<string>(PAYMENT_METHOD_KEYS.CASH);
  const [includeJoining, setIncludeJoining] = useState<boolean>(isFirstJoin);
  const [advanced, setAdvanced] = useState(false);
  const [paid, setPaid] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Default to first active plan once loaded.
  const selectedPlan: MembershipPlan | undefined =
    activePlans.find((p) => p.plan_id === planId) ?? activePlans[0];
  const effectivePlanId = planId || selectedPlan?.plan_id || "";

  const joiningMinor = includeJoining ? (selectedPlan?.joining_fee_minor ?? 0) : 0;
  const discountMinor = Math.round((Number(discount) || 0) * 100);
  const grossMinor = (selectedPlan?.price_amount_minor ?? 0) + joiningMinor;
  const totalMinor = Math.max(0, grossMinor - discountMinor);

  async function handleConfirm() {
    setError(null);
    if (!effectivePlanId) {
      setError("Please choose a plan.");
      return;
    }
    try {
      await renew.mutateAsync({
        member_id: member.member_id,
        input: {
          plan_id: effectivePlanId,
          payment_method_key: method as RenewMethod,
          include_joining_fee: includeJoining,
          discount_major: Number(discount) || 0,
          discount_reason: "",
          // Only send a paid override when advanced mode is used.
          amount_paid_major: advanced && paid !== "" ? Number(paid) : undefined,
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Renewal failed. Please try again.");
    }
  }

  if (isLoading) {
    return <div className="space-y-3"><div className="skeleton h-11 w-full" /><div className="skeleton h-24 w-full" /></div>;
  }

  if (activePlans.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
        No active plans. Ask the owner to add a membership plan first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Select
        label="Plan"
        value={effectivePlanId}
        onChange={(e) => setPlanId(e.target.value)}
        options={activePlans.map((p) => ({
          value: p.plan_id,
          label: `${p.plan_display_name} · ${formatMoney(p.price_amount_minor, currency)}`,
        }))}
      />

      {selectedPlan && selectedPlan.joining_fee_minor > 0 && (
        <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-3 py-3">
          <input
            type="checkbox"
            checked={includeJoining}
            onChange={(e) => setIncludeJoining(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand)]"
          />
          <span className="text-sm">
            Add joining fee ({formatMoney(selectedPlan.joining_fee_minor, currency)})
            {isFirstJoin ? " — first join" : ""}
          </span>
        </label>
      )}

      <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} options={methodOptions} />

      {/* Total summary — always visible */}
      <div className="rounded-[var(--radius-card)] border border-brand/30 bg-brand/10 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Total to collect</span>
          {advanced && discountMinor > 0 ? (
            <span className="line-through opacity-60">{formatMoney(grossMinor, currency)}</span>
          ) : null}
        </div>
        <p className="text-2xl font-bold text-brand">{formatMoney(totalMinor, currency)}</p>
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="text-sm font-medium text-brand"
      >
        {advanced ? "− Hide" : "+ Add discount / partial payment"}
      </button>

      {advanced && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Discount (${currency})`}
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
          />
          <Input
            label={`Amount paid (${currency})`}
            inputMode="decimal"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder={String(toMajor(totalMinor, currency))}
            hint="Leave blank = full"
          />
        </div>
      )}

      {error ? (
        <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button className="w-full" size="lg" onClick={handleConfirm} isLoading={renew.isPending}>
        Confirm renewal · {formatMoney(totalMinor, currency)}
      </Button>
    </div>
  );
}

type RenewMethod = "cash" | "upi" | "card";
