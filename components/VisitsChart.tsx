"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { DailyVisits } from "@/lib/types";

function formatDayLabel(dateStr: string): string {
  // dateStr is a UTC calendar day (YYYY-MM-DD) — render it as a short local weekday/day.
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
  });
}

export function VisitsChart({ days }: { days: DailyVisits[] }) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const n = days.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        {t("users.noVisits")}
      </div>
    );
  }

  // Everything below is expressed as a 0–100 fraction of the chart box, so
  // the SVG line and the HTML dots/hover-zones (which share the same
  // formulas) always land on the same pixel regardless of the chart's actual
  // rendered size.
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (count: number) => (count / max) * 100;

  const linePoints = days.map((d, i) => `${xPct(i)},${100 - yPct(d.count)}`).join(" ");

  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
      <div className="relative h-[140px] w-full" style={{ overflow: "visible" }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <polyline
            points={linePoints}
            fill="none"
            stroke="#3ddc97"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {days.map((d, i) => (
          <div
            key={d.date}
            className="absolute top-0 h-full cursor-default"
            style={{ left: `${xPct(i)}%`, width: `${100 / n}%`, transform: "translateX(-50%)" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          >
            <div
              className="absolute rounded-full transition-transform"
              style={{
                left: "50%",
                bottom: `${yPct(d.count)}%`,
                width: 7,
                height: 7,
                marginLeft: -3.5,
                marginBottom: -3.5,
                background: d.count > 0 ? "#3ddc97" : "rgba(255,255,255,0.2)",
                transform: hovered === i ? "scale(1.6)" : "scale(1)",
              }}
            />
            {hovered === i && (
              <div
                className="absolute z-10 w-max max-w-[220px] rounded-[8px] border border-surface-border px-2.5 py-1.5 text-[11px] shadow-lg"
                style={{
                  left: "50%",
                  bottom: `calc(${yPct(d.count)}% + 12px)`,
                  transform: "translateX(-50%)",
                  background: "#12161d",
                }}
              >
                <div className="font-mono font-semibold text-q-text">
                  {formatDayLabel(d.date)}: {d.count} {t("users.loginsWord")}
                </div>
                <div className="mt-0.5 text-q-sub">
                  {d.users.length > 0 ? d.users.join(", ") : t("users.noLoginsTooltip")}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center font-mono text-[10px] text-q-dim">
        {days.map((d) => (
          <span key={d.date} className="flex-1 truncate text-center">
            {formatDayLabel(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
