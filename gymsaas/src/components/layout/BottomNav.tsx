"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { navForRole } from "./nav";
import type { RoleKey } from "@/lib/domain/constants";

/**
 * Mobile bottom navigation (audit 4.3). Shows primary destinations + "More".
 * Hidden on desktop (lg+), where the sidebar is used instead.
 */
export function BottomNav({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const all = navForRole(role);
  const primary = all.filter((i) => i.mobilePrimary).slice(0, 3);

  const items = [
    ...primary,
    { label: "More", href: "/app/more", icon: "⋯", roles: [role] as RoleKey[] },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted hover:text-foreground",
                )}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
