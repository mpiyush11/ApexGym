"use client";

/**
 * Lightweight inline SVG bar chart — no external chart library (keeps the
 * bundle small, renders in the sandboxed preview, fast at any data size since
 * we only ever plot ≤24 bars). Mobile-first: horizontally scrollable on narrow
 * screens, fixed bar widths so labels never overlap on a 360px phone.
 */
export interface BarDatum {
  label: string;
  value: number; // raw value (e.g. minor units or counts)
  display: string; // preformatted tooltip/label text
}

export function BarChart({
  data,
  height = 160,
  tone = "brand",
}: {
  data: BarDatum[];
  height?: number;
  tone?: "brand" | "success" | "info";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 28;
  const gap = 12;
  const width = data.length * (barW + gap) + gap;
  const color =
    tone === "success" ? "var(--success)" : tone === "info" ? "var(--info)" : "var(--brand)";

  return (
    <div className="-mx-1 overflow-x-auto">
      <svg
        width={width}
        height={height + 28}
        viewBox={`0 0 ${width} ${height + 28}`}
        className="min-w-full"
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * height);
          const x = gap + i * (barW + gap);
          const y = height - h;
          return (
            <g key={d.label + i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={5}
                fill={color}
                opacity={0.9}
              >
                <title>{`${d.label}: ${d.display}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={height + 18}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
