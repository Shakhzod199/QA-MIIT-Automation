import { formatRelativeTime } from "@/lib/format";
import type { RunStats } from "@/lib/types";

export function StatCard({
  label,
  value,
  sub,
  title,
  interactive = false,
}: {
  label: string;
  value: string;
  sub?: string;
  // Hover tooltip text; defaults to "label: value (sub)" when omitted.
  title?: string;
  // Set when the card is wrapped in a Link, so hovering it signals that.
  interactive?: boolean;
}) {
  return (
    <div
      title={title ?? `${label}: ${value}${sub ? ` (${sub})` : ""}`}
      className={`rounded-lg border border-surface-border bg-surface-panel p-4 transition ${
        interactive ? "hover:border-indigo-500/40 hover:bg-surface-hover" : ""
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className={`mt-1 text-xs ${interactive ? "text-indigo-400" : "text-gray-500"}`}>{sub}</p>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: RunStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Runs" value={String(stats.total)} title={`${stats.total} total runs recorded`} />
      <StatCard
        label="Pass Rate"
        value={`${stats.passRate}%`}
        title={`${stats.passRate}% of completed runs passed`}
      />
      <StatCard
        label="Fail Rate"
        value={`${stats.failRate}%`}
        title={`${stats.failRate}% of completed runs failed`}
      />
      <StatCard
        label="Last Run"
        value={formatRelativeTime(stats.lastRunAt)}
        title={stats.lastRunAt ? `Last run at ${new Date(stats.lastRunAt).toLocaleString()}` : "No runs yet"}
      />
    </div>
  );
}
