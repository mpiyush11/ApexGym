import type { RoleKey } from "@/lib/domain/constants";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // emoji placeholder (sandbox-safe, no external icon fonts)
  roles: RoleKey[];
  /** Show in the mobile bottom bar (max ~4 + "More"). */
  mobilePrimary?: boolean;
}

/**
 * Single source of truth for navigation, filtered by role.
 * Owner sees everything; Reception sees a minimal set; Member uses
 * the separate member portal.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app", icon: "📊", roles: ["owner", "reception"], mobilePrimary: true },
  { label: "Members", href: "/app/members", icon: "🧑‍🤝‍🧑", roles: ["owner", "reception"], mobilePrimary: true },
  { label: "Renewals", href: "/app/renewals", icon: "🔁", roles: ["owner", "reception"], mobilePrimary: true },
  { label: "Leads", href: "/app/leads", icon: "📥", roles: ["owner", "reception"] },
  { label: "Plans", href: "/app/plans", icon: "🏷️", roles: ["owner"] },
  { label: "Analytics", href: "/app/analytics", icon: "📈", roles: ["owner"] },
  { label: "Trainers", href: "/app/trainers", icon: "💪", roles: ["owner"] },
  { label: "Gallery", href: "/app/gallery", icon: "🖼️", roles: ["owner"] },
  { label: "Testimonials", href: "/app/testimonials", icon: "⭐", roles: ["owner"] },
  { label: "Reports", href: "/app/reports", icon: "📄", roles: ["owner"] },
  { label: "Settings", href: "/app/settings", icon: "⚙️", roles: ["owner"] },
];

export function navForRole(role: RoleKey): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
