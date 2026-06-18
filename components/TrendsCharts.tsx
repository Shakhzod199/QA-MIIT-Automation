"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import {
  durationSeries,
  rollingPassRate,
  suiteBreakdown,
  trendSummary,
} from "@/lib/trends";
import type { RunSummary } from "@/lib/types";

function barColor(conclusion: string | null): string {
  if (conclusion === "success") return "bg-emerald-500/80 hover:bg-emerald-400";
  if (conclusion === "failure") return "bg-red-500/80 hover:bg-red-400";
  if (conclusion === "cancelled") return "bg-amber-500/70 hover:bg-amber-400";
  return "bg-gray-600 hover:bg-gray-500";
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function DurationChart({ runs }: { runs: RunSummary[] }) {
  const series = useMemo(() => durationSeries(runs), [runs]);
  const max = Math.max(1, ...series.map((p) => p.durationSec));

  if (series.length === 0) {
    return <p className="text-sm text-gray-500">No completed runs to chart yet.</p>;
  }

  return (
    <div>
      <div className="flex h-44 items-end gap-px">
        {series.map((p) => (
          <Link
            key={p.id}
            href={`/reports/${p.id}`}
            title={`#${p.runNumber} · ${p.conclusion ?? "?"} · ${formatDuration(p.durationSec)} · ${formatRelativeTime(p.createdAt)}`}
            className="group flex flex-1 items-end"
            style={{ minWidth: 3 }}
          >
            <div
              className={`w-full rounded-t-sm transition-colors ${barColor(p.conclusion)}`}
              style={{ height: `${Math.max(2, (p.durationSec / max) * 100)}%` }}
            />
          </Link>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{formatRelativeTime(series[0].createdAt)}</span>
        <span>max {formatDuration(max)}</span>
        <span>{formatRelativeTime(series[series.length - 1].createdAt)}</span>
      </div>
    </div>
  );
}

function PassRateChart({ runs }: { runs: RunSummary[] }) {
  const points = useMemo(() => rollingPassRate(runs, 5), [runs]);

  if (points.length < 2) {
    return <p className="text-sm text-gray-500">Need at least 2 completed runs to show a trend.</p>;
  }

  const n = points.length;
  const coords = points.map((p, i) => ({
    x: (i / (n - 1)) * 100,
    y: (1 - p.rate) * 100,
  }));
  const line = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  const latest = Math.round(points[n - 1].rate * 100);

  return (
    <div>
      <div className="relative h-44 w-full overflow-hidden rounded-md bg-surface-hover/30">
        {/* gridlines at 0 / 50 / 100% */}
        {[0, 50, 100].map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 border-t border-surface-border/60"
            style={{ top: `${g}%` }}
          >
            <span className="absolute -top-2 left-1 text-[10px] text-gray-600">{100 - g}%</span>
          </div>
        ))}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={area} fill="rgb(16 185 129 / 0.12)" />
          <polyline
            points={line}
            fill="none"
            stroke="rgb(16 185 129)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute right-2 top-2 rounded bg-surface-panel/80 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
          {latest}% now
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{formatRelativeTime(points[0].createdAt)}</span>
        <span>5-run trailing pass rate</span>
        <span>{formatRelativeTime(points[n - 1].createdAt)}</span>
      </div>
    </div>
  );
}

function SuiteTable({ runs }: { runs: RunSummary[] }) {
  const suites = useMemo(() => suiteBreakdown(runs), [runs]);
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Suite</th>
            <th className="px-4 py-3">Runs</th>
            <th className="px-4 py-3">Pass rate</th>
            <th className="px-4 py-3">Avg duration</th>
            <th className="px-4 py-3">Last run</th>
          </tr>
        </thead>
        <tbody>
          {suites.map((s) => (
            <tr key={s.name} className="border-b border-surface-border last:border-0">
              <td className="px-4 py-3">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-xs text-indigo-300">
                  {s.name}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-300">{s.total}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-border">
                    <div
                      className={`h-full rounded-full ${s.passRate >= 80 ? "bg-emerald-500" : s.passRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${s.passRate}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs text-gray-400">{s.passRate}%</span>
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-400">
                {s.avgDurationSec != null ? formatDuration(s.avgDurationSec) : "—"}
              </td>
              <td className="px-4 py-3 text-gray-500">{formatRelativeTime(s.lastRunAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
      <h3 className="mb-4 text-sm font-medium text-gray-300">{title}</h3>
      {children}
    </div>
  );
}

export function TrendsView({ runs }: { runs: RunSummary[] }) {
  const summary = useMemo(() => trendSummary(runs), [runs]);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        No runs yet to build trends from.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Pass Rate" value={`${summary.passRate}%`} hint={`${summary.completedRuns} completed runs`} />
        <Kpi label="Fail Rate" value={`${100 - summary.passRate}%`} />
        <Kpi
          label="Avg Duration"
          value={summary.avgDurationSec != null ? formatDuration(summary.avgDurationSec) : "—"}
        />
        <Kpi
          label="Median Duration"
          value={summary.medianDurationSec != null ? formatDuration(summary.medianDurationSec) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Run duration & outcome (oldest → newest)">
          <DurationChart runs={runs} />
        </ChartCard>
        <ChartCard title="Pass rate over time">
          <PassRateChart runs={runs} />
        </ChartCard>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">By suite</h3>
        <SuiteTable runs={runs} />
      </div>
    </div>
  );
}
