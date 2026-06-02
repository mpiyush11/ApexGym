"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { navForRole } from "./nav";
import type { RoleKey } from "@/lib/domain/constants";
import { appConfig } from "@/lib/config/env";

/** Desktop sidebar (hidden on mobile; bottom nav used there instead). */
export function Sidebar({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-surface-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-surface-border px-5">
        <span className="text-xl">🏋️</span>
        <span className="text-lg font-bold tracking-tight">
          {appConfig.appName}
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand/15 text-brand"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-surface-border p-4 text-xs text-muted">
        {appConfig.appName} • v0.1
      </div>
    </aside>
  );
}
