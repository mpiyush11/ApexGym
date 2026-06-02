"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { MEMBER_TIER_KEYS, type MemberTierKey } from "@/lib/domain/constants";
import { useCreateMember, useUpdateMember } from "./useMembers";
import { MembershipHistory } from "./MembershipHistory";
import { appConfig } from "@/lib/config/env";
import type { Member } from "@/lib/domain/types";
import { ApiError } from "@/lib/services/apiClient";

const tierOptions = [
  { value: MEMBER_TIER_KEYS.STANDARD, label: "Standard" },
  { value: MEMBER_TIER_KEYS.GOLD, label: "Gold" },
  { value: MEMBER_TIER_KEYS.PLATINUM, label: "Platinum" },
];

export function MemberFormSheet({
  open,
  onClose,
  editing,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  editing: Member | null;
  onCreated?: (member: Member) => void;
}) {
  const formKey = `${open ? "open" : "closed"}:${editing?.member_id ?? "new"}`;
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit member" : "Add member"}>
      <MemberFormBody
        key={formKey}
        editing={editing}
        onDone={onClose}
        onCreated={onCreated}
      />
    </Sheet>
  );
}

function MemberFormBody({
  editing,
  onDone,
  onCreated,
}: {
  editing: Member | null;
  onDone: () => void;
  onCreated?: (member: Member) => void;
}) {
  const create = useCreateMember();
  const update = useUpdateMember();

  const [name, setName] = useState(editing?.member_display_name ?? "");
  const [phone, setPhone] = useState(editing?.member_phone ?? "");
  const [email, setEmail] = useState(editing?.member_email ?? "");
  const [tier, setTier] = useState<string>(
    editing?.member_tier_key ?? MEMBER_TIER_KEYS.STANDARD,
  );
  const [notes, setNotes] = useState(editing?.member_notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState(false);

  const busy = create.isPending || update.isPending;

  async function handleSave() {
    setError(null);
    const input = {
      member_display_name: name.trim(),
      member_phone: phone.trim(),
      member_email: email.trim(),
      member_tier_key: tier as MemberTierKey,
      member_notes: notes.trim(),
    };
    try {
      if (editing) {
        await update.mutateAsync({ member_id: editing.member_id, input });
        onDone();
      } else {
        const res = await create.mutateAsync(input);
        if (res.duplicate_warning && !dupWarning) {
          // First save attempt with a duplicate phone: created, but inform.
          setDupWarning(true);
        }
        onCreated?.(res.member);
        onDone();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the member.");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aarav Sharma"
          autoComplete="name"
        />
        <Input
          label="Phone"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 90000 00000"
          autoComplete="tel"
          hint="Primary way to find this member"
        />
        {dupWarning && (
          <p className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Note: another member already uses this phone number.
          </p>
        )}
        <Input
          label="Email (optional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aarav@email.com"
          autoComplete="email"
        />
        <Select label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} options={tierOptions} />
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember…" />

        {editing ? (
          <div className="pt-2">
            <p className="mb-2 text-sm font-semibold">Renewal history</p>
            <MembershipHistory member_id={editing.member_id} currency={appConfig.defaultCurrency} />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-5">
        <Button className="w-full" size="lg" onClick={handleSave} isLoading={busy}>
          {editing ? "Save changes" : "Add member"}
        </Button>
      </div>
    </>
  );
}
