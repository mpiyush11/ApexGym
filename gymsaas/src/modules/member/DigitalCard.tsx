"use client";

import { formatMoney } from "@/lib/money/money";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import type { MemberCardBundle } from "./useMemberCard";

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#34d399" },
  expiring_soon: { label: "Expiring soon", color: "#fbbf24" },
  expired: { label: "Expired", color: "#f87171" },
  inactive: { label: "Inactive", color: "#9aa6b8" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Live digital membership card — rendered ENTIRELY from existing member +
 * membership-summary records. Mobile-first (360–430px): full-width, big status,
 * expiry/days-left, member_code, photo, renew-via-WhatsApp.
 */
export function DigitalCard({ card }: { card: MemberCardBundle }) {
  const brand = card.gym_primary_color_hex || "#d4af37";
  const status = STATUS_META[card.member_status_key] ?? STATUS_META.inactive;
  const left = daysLeft(card.membership_end_date);
  const renewWa = buildWhatsAppLink(
    card.gym_whatsapp_number,
    `Hi ${card.gym_display_name}, I'd like to renew my membership (${card.member_code}).`,
  );

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Card */}
      <div
        className="relative overflow-hidden rounded-2xl border border-surface-border p-5 shadow-[var(--shadow-md)]"
        style={{ background: `linear-gradient(160deg, ${brand}22, var(--surface) 60%)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted">{card.gym_display_name}</p>
            <p className="mt-1 truncate text-lg font-bold">{card.member_display_name}</p>
            <p className="text-xs text-muted">{card.member_code}</p>
          </div>
          {card.member_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- member photo URL
            <img src={card.member_photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-black"
              style={{ background: brand }}
            >
              {card.member_display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Status pill */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
          style={{ background: `${status.color}22`, color: status.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
          {status.label}
        </div>

        {/* Details grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Detail label="Plan" value={card.plan_name_snapshot ?? "—"} />
          <Detail label="Expires" value={fmtDate(card.membership_end_date)} />
          <Detail label="Member since" value={fmtDate(card.member_join_date)} />
          <Detail
            label="Days left"
            value={left == null ? "—" : left < 0 ? `${Math.abs(left)} overdue` : `${left}`}
            valueColor={left != null && left <= 0 ? "#f87171" : undefined}
          />
        </div>

        {card.amount_due_minor > 0 ? (
          <p className="mt-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Balance due: {formatMoney(card.amount_due_minor, card.currency_code)}
          </p>
        ) : null}
      </div>

      {/* Renew CTA (deep-links to gym WhatsApp; no new system) */}
      {renewWa ? (
        <a
          href={renewWa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-card)] px-6 font-semibold text-black"
          style={{ background: brand }}
        >
          💬 Renew via WhatsApp
        </a>
      ) : null}

      <p className="mt-3 text-center text-[11px] text-muted">
        Status updates automatically. Show this card at the gym.
      </p>
    </div>
  );
}

function Detail({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 truncate font-semibold" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
    </div>
  );
}
