import type { ReactNode } from "react";
import type { RoleKey } from "@/lib/domain/constants";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Topbar } from "./Topbar";

/**
 * Mobile-first application shell.
 *  - Mobile: top bar + content + fixed bottom nav (no sidebar).
 *  - Desktop (lg+): sidebar + top bar + content (no bottom nav).
 * No horizontal scroll at any breakpoint.
 */
export function AppShell({
  role,
  title,
  children,
}: {
  role: RoleKey;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} role={role} />
        <main className="flex-1 px-4 py-5 pb-safe sm:px-6 lg:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        <BottomNav role={role} />
      </div>
    </div>
  );
}
