"use client";

import type { ReactNode } from "react";

/**
 * MANDATORY MOBILE-FIRST PATTERN (audit 4.1):
 * Data lists render as stacked CARDS on mobile and as a TABLE on large
 * screens (lg+). Never a raw overflowing table on a phone.
 *
 * Usage:
 *   <ResponsiveList
 *     items={members}
 *     getKey={(m) => m.member_id}
 *     columns={[{ header: "Name", cell: (m) => m.member_display_name }, ...]}
 *     renderCard={(m) => <MemberCard member={m} />}
 *   />
 */

export interface Column<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

export function ResponsiveList<T>({
  items,
  columns,
  getKey,
  renderCard,
}: {
  items: T[];
  columns: Column<T>[];
  getKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
}) {
  return (
    <>
      {/* Mobile / tablet: cards */}
      <div className="space-y-3 lg:hidden">
        {items.map((item) => (
          <div key={getKey(item)} className="animate-fade-in-up">
            {renderCard(item)}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-surface-border lg:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className="px-4 py-3 text-left font-semibold text-muted"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={getKey(item)}
                className="border-t border-surface-border bg-surface hover:bg-surface-2/60"
              >
                {columns.map((col, i) => (
                  <td key={i} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
