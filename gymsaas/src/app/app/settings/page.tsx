"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import {
  useSettings,
  useSaveSettings,
  useStaff,
  useSetStaffActive,
} from "@/modules/settings/useSettings";
import { InviteStaffSheet } from "@/modules/settings/InviteStaffSheet";
import { ApiError } from "@/lib/services/apiClient";

export default function SettingsPage() {
  const session = useAppSession();

  // Settings page is owner-only; reception is redirected away by content.
  if (session.role !== "owner" && !session.previewMode) {
    return (
      <AppShell role={session.role} title="Settings">
        <EmptyState title="Owner only" description="Only the gym owner can manage settings." icon="🔒" />
      </AppShell>
    );
  }

  return <SettingsContent />;
}

function SettingsContent() {
  const session = useAppSession();
  const { data, isLoading, isError, refetch } = useSettings();
  const save = useSaveSettings();
  const staff = useStaff();
  const setActive = useSetStaffActive();

  const [form, setForm] = useState<Record<string, string>>({});
  const [reminderDays, setReminderDays] = useState<number | null>(null);
  const [published, setPublished] = useState<boolean | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Seed local form state once data arrives (keyed render below).
  const v = data;
  function field(name: string, fallback: string) {
    return form[name] ?? fallback;
  }

  async function handleSave() {
    if (!v) return;
    setError(null);
    setSavedMsg(null);
    try {
      await save.mutateAsync({
        gym_display_name: field("gym_display_name", v.gym_display_name),
        gym_whatsapp_number: field("gym_whatsapp_number", v.gym_whatsapp_number),
        gym_contact_phone: field("gym_contact_phone", v.gym_contact_phone),
        gym_contact_email: field("gym_contact_email", v.gym_contact_email),
        gym_city: field("gym_city", v.gym_city),
        renewal_reminder_days_before: reminderDays ?? v.renewal_reminder_days_before,
        report_recipient_emails: field("report_recipient_emails", v.report_recipient_emails.join(", "))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        public_site_is_published: published ?? v.public_site_is_published,
      });
      setSavedMsg("Settings saved.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save settings.");
    }
  }

  return (
    <AppShell role={session.role} title="Settings">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to manage settings.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : isError || !v ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-5">
          {/* Gym details */}
          <Card>
            <CardHeader title="Gym details" subtitle="Shown on your public site & messages" />
            <CardBody>
              <div className="space-y-4">
                <Input label="Gym name" defaultValue={v.gym_display_name}
                  onChange={(e) => setForm((f) => ({ ...f, gym_display_name: e.target.value }))} />
                <Input label="WhatsApp number" inputMode="tel" defaultValue={v.gym_whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, gym_whatsapp_number: e.target.value }))}
                  placeholder="+91 90000 00000" hint="Used for the WhatsApp CTA" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Contact phone" inputMode="tel" defaultValue={v.gym_contact_phone}
                    onChange={(e) => setForm((f) => ({ ...f, gym_contact_phone: e.target.value }))} />
                  <Input label="Contact email" type="email" defaultValue={v.gym_contact_email}
                    onChange={(e) => setForm((f) => ({ ...f, gym_contact_email: e.target.value }))} />
                </div>
                <Input label="City" defaultValue={v.gym_city}
                  onChange={(e) => setForm((f) => ({ ...f, gym_city: e.target.value }))} />
              </div>
            </CardBody>
          </Card>

          {/* Renewals & reports */}
          <Card>
            <CardHeader title="Renewals & reports" />
            <CardBody>
              <div className="space-y-4">
                <Input label="Expiry reminder (days before)" inputMode="numeric"
                  defaultValue={String(v.renewal_reminder_days_before)}
                  onChange={(e) => setReminderDays(Number(e.target.value) || v.renewal_reminder_days_before)} />
                <Input label="Weekly report recipients (comma-separated)"
                  defaultValue={v.report_recipient_emails.join(", ")}
                  onChange={(e) => setForm((f) => ({ ...f, report_recipient_emails: e.target.value }))}
                  placeholder="owner@gym.com, manager@gym.com" />
                <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-3 py-3">
                  <input type="checkbox" defaultChecked={v.public_site_is_published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="h-5 w-5 accent-[var(--brand)]" />
                  <span className="text-sm">Publish public website</span>
                </label>
                {!session.previewMode && v.gym_slug ? (
                  <a
                    href={`/g/${v.gym_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-medium text-brand"
                  >
                    ↗ View public website (/g/{v.gym_slug})
                  </a>
                ) : null}
              </div>
            </CardBody>
          </Card>

          {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
          {error ? (
            <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}
          <Button className="w-full" size="lg" onClick={handleSave} isLoading={save.isPending}>
            Save settings
          </Button>

          {/* Staff management */}
          <Card>
            <CardHeader
              title="Reception staff"
              subtitle="Front-desk logins (cannot see revenue or settings)"
              action={<Button size="sm" onClick={() => setInviteOpen(true)}>Add</Button>}
            />
            <CardBody>
              {staff.isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : staff.isError ? (
                <ErrorState onRetry={() => staff.refetch()} />
              ) : !staff.data || staff.data.filter((u) => u.app_user_role_key === "reception").length === 0 ? (
                <EmptyState title="No reception staff" description="Add a front-desk login to share daily work." icon="🧑‍💼" />
              ) : (
                <ul className="divide-y divide-surface-border">
                  {staff.data.filter((u) => u.app_user_role_key === "reception").map((u) => (
                    <li key={u.app_user_id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.app_user_display_name || u.app_user_email}</p>
                        <p className="truncate text-xs text-muted">{u.app_user_email}</p>
                      </div>
                      {u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}
                      <Button
                        size="sm"
                        variant={u.is_active ? "ghost" : "secondary"}
                        onClick={() => setActive.mutate({ app_user_id: u.app_user_id, is_active: !u.is_active })}
                      >
                        {u.is_active ? "Disable" : "Enable"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <InviteStaffSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </AppShell>
  );
}
