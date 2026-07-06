"use client";

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
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        {t("users.noVisits")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
      <div className="flex h-[140px] gap-1.5">
        {days.map((d) => (
          <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${d.date}: ${d.count}`}>
            <div className="flex h-full w-full items-end">
              <div
                className="w-full rounded-t-[4px] bg-q-green transition-all"
                style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, opacity: d.count === 0 ? 0.15 : 1 }}
              />
            </div>
            <span className="truncate font-mono text-[10px] text-q-dim">{formatDayLabel(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
