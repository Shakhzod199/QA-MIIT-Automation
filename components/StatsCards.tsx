import { formatRelativeTime } from "@/lib/format";
import type { RunStats } from "@/lib/types";

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: RunStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Runs" value={String(stats.total)} />
      <StatCard label="Pass Rate" value={`${stats.passRate}%`} />
      <StatCard label="Fail Rate" value={`${stats.failRate}%`} />
      <StatCard label="Last Run" value={formatRelativeTime(stats.lastRunAt)} />
    </div>
  );
}
