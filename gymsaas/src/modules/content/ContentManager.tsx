"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Fab } from "@/components/ui/Fab";
import { SkeletonCardList } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useContentList, useDeleteContent } from "./useContent";
import { ContentEditorSheet } from "./ContentEditorSheet";
import type { ContentConfig } from "./contentConfig";

/** Generic, mobile-first CMS manager for a content type (owner-only). */
export function ContentManager({ config }: { config: ContentConfig }) {
  const session = useAppSession();
  const { data, isLoading, isError, refetch } = useContentList<Record<string, unknown>>(config.kind);
  const del = useDeleteContent(config.kind);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);

  return (
    <AppShell role={session.role} title={config.title}>
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to manage {config.title.toLowerCase()}.
        </div>
      )}

      <p className="mb-4 text-sm text-muted">
        These appear on your public website. {config.kind === "gallery" ? "Mark one image as the hero." : ""}
      </p>

      {isLoading ? (
        <SkeletonCardList rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={`No ${config.title.toLowerCase()} yet`}
          description={`Add your first ${config.singular.toLowerCase()} to show it on the website.`}
          icon={config.icon}
          action={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}>Add {config.singular.toLowerCase()}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const id = String(item[config.idField]);
            const img = config.imageField ? (item[config.imageField] as string | undefined) : undefined;
            const isActive = item.is_active !== false;
            return (
              <Card key={id} className="p-4">
                <div className="flex items-center gap-3">
                  {config.imageField ? (
                    img ? (
                      // eslint-disable-next-line @next/next/no-img-element -- owner image URL
                      <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-[var(--radius-card)] object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-surface-2 text-lg">
                        {config.icon}
                      </div>
                    )
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{config.primary(item) || "(untitled)"}</p>
                      {item.is_hero_gallery ? <Badge tone="brand">Hero</Badge> : null}
                      {!isActive ? <Badge tone="neutral">Hidden</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted">{config.secondary(item)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1"
                    onClick={() => { setEditing(item); setEditorOpen(true); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(item)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Fab onClick={() => { setEditing(null); setEditorOpen(true); }} label={`Add ${config.singular.toLowerCase()}`} />

      <ContentEditorSheet config={config} open={editorOpen} onClose={() => setEditorOpen(false)} editing={editing} />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Delete ${config.singular.toLowerCase()}?`}
        description="This removes it from your website. This cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={del.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) await del.mutateAsync(String(confirm[config.idField]));
          setConfirm(null);
        }}
      />
    </AppShell>
  );
}
