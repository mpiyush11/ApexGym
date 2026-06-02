"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/lib/config/env";
import type { RoleKey } from "@/lib/domain/constants";
import { signOut } from "@/lib/auth/authClient";

const roleLabel: Record<RoleKey, string> = {
  platform_admin: "Platform Admin",
  owner: "Owner",
  reception: "Reception",
  member: "Member",
};

/** Mobile-first top bar with title + role indicator + account menu. */
export function Topbar({
  title,
  role,
}: {
  title: string;
  role: RoleKey;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-surface-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <span className="text-lg">🏋️</span>
        <span className="font-bold">{appConfig.appName}</span>
      </div>
      <h1 className="hidden text-lg font-semibold lg:block">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-surface-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
          {roleLabel[role]}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Account menu"
            aria-expanded={open}
          >
            GO
          </button>
          {open ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-[var(--radius-card)] border border-surface-border bg-surface shadow-[var(--shadow-md)]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full px-4 py-3 text-left text-sm text-foreground hover:bg-surface-2"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
