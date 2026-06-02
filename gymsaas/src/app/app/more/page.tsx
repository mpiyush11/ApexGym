"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { navForRole } from "@/components/layout/nav";

/** Mobile "More" hub — shows all role destinations not in the bottom bar. */
export default function MorePage() {
  const session = useAppSession();
  const items = navForRole(session.role);

  return (
    <AppShell role={session.role} title="More">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] border border-surface-border bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
