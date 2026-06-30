import { formatRelativeTime } from "@/lib/format";
import type { RunStats } from "@/lib/types";

export function StatCard({
  label,
  value,
  delta,
  deltaColor,
  valueColor,
  sub,
  interactive = false,
  title,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
  valueColor?: string;
  sub?: string;
  interactive?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}${sub ? ` (${sub})` : ""}`}
      className={`rounded-[12px] border border-surface-border bg-surface-panel p-4 transition ${
        interactive ? "hover:border-[rgba(61,220,151,0.3)] hover:bg-surface-hover" : ""
      }`}
    >
      <p className="text-[12px] font-medium text-q-muted">{label}</p>
      <div className="mt-[9px] flex items-baseline gap-2">
        <p
          className="text-[32px] font-bold leading-none tracking-[-1px] text-q-text"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
        {delta && (
          <span
            className="font-mono text-[12px] font-semibold"
            style={{ color: deltaColor ?? "#3ddc97" }}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && (
        <p className={`mt-1 text-[11px] ${interactive ? "text-q-green" : "text-q-dim"}`}>{sub}</p>
      )}
    </div>
  );
}

export function StatsCards({ stats }: { stats: RunStats }) {
  return (
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Pass rate · 24h"
        value={`${stats.passRate}%`}
        title={`${stats.passRate}% of completed runs passed`}
      />
      <StatCard
        label="Runs · 24h"
        value={String(stats.total)}
        title={`${stats.total} total runs recorded`}
      />
      <StatCard
        label="Fail rate"
        value={`${stats.failRate}%`}
        valueColor={stats.failRate > 0 ? "#ff5d5d" : undefined}
        title={`${stats.failRate}% of completed runs failed`}
      />
      <StatCard
        label="Last run"
        value={formatRelativeTime(stats.lastRunAt)}
        title={stats.lastRunAt ? `Last run at ${new Date(stats.lastRunAt).toLocaleString()}` : "No runs yet"}
      />
    </div>
  );
}
