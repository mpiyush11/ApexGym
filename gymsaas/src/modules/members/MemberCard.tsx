"use client";

import { Card } from "@/components/ui/Card";
import { MemberStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Member } from "@/lib/domain/types";

/**
 * Mobile-first member card with quick actions (one-handed use).
 * Whole card is tappable to view/edit; the Renew button is a primary quick
 * action wired in M4. Avatar shows photo or initial.
 */
export function MemberCard({
  member,
  onEdit,
  onRenew,
}: {
  member: Member;
  onEdit: (m: Member) => void;
  onRenew?: (m: Member) => void;
}) {
  const end = member.current_membership_summary?.membership_end_date;
  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => onEdit(member)}
        className="flex w-full items-center gap-3 text-left"
      >
        <Avatar name={member.member_display_name} url={member.member_photo_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{member.member_display_name}</p>
          <p className="truncate text-xs text-muted">
            {member.member_code} • {member.member_phone}
          </p>
          {end ? (
            <p className="mt-0.5 truncate text-[11px] text-muted">
              Expires {formatDate(end)}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted">No active membership</p>
          )}
        </div>
        <MemberStatusBadge status={member.member_status_key} />
      </button>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => onRenew?.(member)}>
          Renew
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onEdit(member)}>
          Edit
        </Button>
      </div>
    </Card>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- member photos are arbitrary external/storage URLs; next/image config comes in M8
      <img
        src={url}
        alt={name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-semibold text-brand">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
