"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Fab } from "@/components/ui/Fab";
import { SkeletonCardList } from "@/components/feedback/Skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { useDebounce } from "@/lib/utils/useDebounce";
import {
  useMembersList,
  useMemberSearch,
} from "@/modules/members/useMembers";
import { MemberCard } from "@/modules/members/MemberCard";
import { MemberFormSheet } from "@/modules/members/MemberFormSheet";
import { RenewSheet } from "@/modules/renewals/RenewSheet";
import { appConfig } from "@/lib/config/env";
import type { Member } from "@/lib/domain/types";

export default function MembersPage() {
  const session = useAppSession();
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 350);
  const searching = debounced.trim().length > 0;

  const list = useMembersList();
  const search = useMemberSearch(debounced);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [renewing, setRenewing] = useState<Member | null>(null);

  const members: Member[] = useMemo(() => {
    if (searching) return search.data?.members ?? [];
    return list.data?.pages.flatMap((p) => p.members) ?? [];
  }, [searching, search.data, list.data]);

  const isLoading = searching ? search.isLoading : list.isLoading;
  const isError = searching ? search.isError : list.isError;

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(m: Member) {
    setEditing(m);
    setSheetOpen(true);
  }

  return (
    <AppShell role={session.role} title="Members">
      {session.previewMode && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-warning">Preview mode.</span> Connect Firebase to manage live members.
        </div>
      )}

      {/* Sticky search — thumb-reachable at top */}
      <div className="sticky top-16 z-10 -mx-4 mb-4 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="🔍  Search by name, phone, or code"
          inputMode="search"
          aria-label="Search members"
        />
      </div>

      {isLoading ? (
        <SkeletonCardList rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => (searching ? search.refetch() : list.refetch())} />
      ) : members.length === 0 ? (
        <EmptyState
          title={searching ? "No matches" : "No members yet"}
          description={
            searching
              ? "Try a different name, phone, or member code."
              : "Add your first member to get started."
          }
          icon="🧑‍🤝‍🧑"
          action={!searching ? <Button onClick={openNew}>Add member</Button> : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {members.map((m) => (
              <MemberCard
                key={m.member_id}
                member={m}
                onEdit={openEdit}
                onRenew={setRenewing}
              />
            ))}
          </div>

          {!searching && list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => list.fetchNextPage()}
                isLoading={list.isFetchingNextPage}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <Fab onClick={openNew} label="Add member" />

      <MemberFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        editing={editing}
      />

      <RenewSheet
        open={Boolean(renewing)}
        onClose={() => setRenewing(null)}
        member={renewing}
        currency={appConfig.defaultCurrency}
      />
    </AppShell>
  );
}
