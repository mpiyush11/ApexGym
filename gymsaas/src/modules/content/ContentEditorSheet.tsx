"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useCreateContent, useUpdateContent } from "./useContent";
import type { ContentConfig, FieldDef } from "./contentConfig";
import { ApiError } from "@/lib/services/apiClient";

/** Generic, mobile-first CMS editor (bottom sheet) driven by field config. */
export function ContentEditorSheet({
  config,
  open,
  onClose,
  editing,
}: {
  config: ContentConfig;
  open: boolean;
  onClose: () => void;
  editing: Record<string, unknown> | null;
}) {
  const key = `${open ? "o" : "c"}:${editing ? String(editing[config.idField]) : "new"}`;
  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Edit ${config.singular.toLowerCase()}` : `Add ${config.singular.toLowerCase()}`}>
      <EditorBody key={key} config={config} editing={editing} onDone={onClose} />
    </Sheet>
  );
}

function initial(config: ContentConfig, editing: Record<string, unknown> | null) {
  const v: Record<string, string | boolean> = {};
  for (const f of config.fields) {
    const cur = editing?.[f.name];
    if (f.type === "checkbox") v[f.name] = typeof cur === "boolean" ? cur : Boolean(f.defaultValue);
    else v[f.name] = cur != null ? String(cur) : String(f.defaultValue ?? "");
  }
  return v;
}

function EditorBody({
  config,
  editing,
  onDone,
}: {
  config: ContentConfig;
  editing: Record<string, unknown> | null;
  onDone: () => void;
}) {
  const create = useCreateContent(config.kind);
  const update = useUpdateContent(config.kind);
  const [form, setForm] = useState(() => initial(config, editing));
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  function setField(name: string, value: string | boolean) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    setError(null);
    // Coerce number fields.
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const raw = form[f.name];
      if (f.type === "number") payload[f.name] = Number(raw) || 0;
      else if (f.type === "checkbox") payload[f.name] = Boolean(raw);
      else payload[f.name] = raw;
    }
    try {
      if (editing) await update.mutateAsync({ id: String(editing[config.idField]), data: payload });
      else await create.mutateAsync(payload);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    }
  }

  return (
    <>
      <div className="space-y-4">
        {config.fields.map((f) => (
          <FieldControl key={f.name} field={f} value={form[f.name]} onChange={(v) => setField(f.name, v)} />
        ))}
        {error ? (
          <p className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}
      </div>
      <div className="mt-5">
        <Button className="w-full" size="lg" onClick={handleSave} isLoading={busy}>
          {editing ? "Save changes" : `Add ${config.singular.toLowerCase()}`}
        </Button>
      </div>
    </>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-surface-border bg-surface-2 px-3 py-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-[var(--brand)]"
        />
        <span className="text-sm">{field.label}</span>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea label={field.label} value={String(value)} placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (field.type === "select") {
    return (
      <Select label={field.label} value={String(value)} options={field.options ?? []}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <Input
      label={field.label}
      type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
      inputMode={field.type === "number" ? "numeric" : undefined}
      value={String(value)}
      placeholder={field.placeholder}
      hint={field.hint}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
