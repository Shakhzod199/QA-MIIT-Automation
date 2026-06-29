"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import {
  durationSeries,
  passRateByProject,
  runTypeBreakdown,
  slowestRuns,
  statusBreakdown,
  suiteBreakdown,
  trendSummary,
  triggerSourceComparison,
} from "@/lib/trends";
import type { RunSummary } from "@/lib/types";

// Matches RunTypeBadge (components/RunsTable.tsx) so a type means the same
// color everywhere on the dashboard.
const TYPE_COLORS: Record<RunSummary["runType"], string> = {
  frontend: "#a78bfa",
  api: "#0ea5e9",
  load: "#f59e0b",
};
const TYPE_LABEL_KEYS: Record<RunSummary["runType"], string> = {
  frontend: "suite.frontend",
  api: "suite.api",
  load: "suite.load",
};
// Matches TriggerSourceBadge.
const SOURCE_COLORS: Record<RunSummary["triggerSource"], string> = {
  manual: "#9ca3af",
  "ci-cd": "#a855f7",
};
// Matches StatusBadge (components/RunsTable.tsx).
const STATUS_COLORS = {
  passed: "#10b981",
  failed: "#ef4444",
  cancelled: "#f59e0b",
  other: "#6b7280",
} as const;

function barColor(conclusion: string | null): string {
  if (conclusion === "success") return "bg-emerald-500/80 hover:bg-emerald-400";
  if (conclusion === "failure") return "bg-red-500/80 hover:bg-red-400";
  if (conclusion === "cancelled") return "bg-amber-500/70 hover:bg-amber-400";
  return "bg-gray-600 hover:bg-gray-500";
}

// Stable per-project line colors (cycles if there are more projects than colors).
const PROJECT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#a78bfa", "#f43f5e", "#22d3ee"];
const colorFor = (index: number) => PROJECT_COLORS[index % PROJECT_COLORS.length];

function LegendDot({ color, className, label, value }: { color?: string; className?: string; label: string; value?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-2.5 w-2.5 rounded-sm ${className ?? ""}`} style={color ? { backgroundColor: color } : undefined} />
      <span className="text-gray-300">{label}</span>
      {value && <span className="tabular-nums text-gray-500">{value}</span>}
    </span>
  );
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

/** Single proportional bar + legend, used for "what kind of runs are these" breakdowns. */
function MixBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) {
    return <p className="text-sm text-gray-500">No runs yet.</p>;
  }
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-border">
        {items
          .filter((i) => i.count > 0)
          .map((i) => (
            <div
              key={i.label}
              title={`${i.label}: ${i.count}`}
              style={{ width: `${(i.count / total) * 100}%`, backgroundColor: i.color }}
            />
          ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((i) => (
          <LegendDot
            key={i.label}
            color={i.color}
            label={i.label}
            value={`${i.count} (${Math.round((i.count / total) * 100)}%)`}
          />
        ))}
      </div>
    </div>
  );
}

/** Side-by-side Manual vs CI/CD comparison — are automated runs as reliable as manual ones? */
function TriggerComparisonCards({
  items,
}: {
  items: { source: RunSummary["triggerSource"]; count: number; passRate: number; avgDurationSec: number | null }[];
}) {
  const { t } = useI18n();
  if (items.every((i) => i.count === 0)) {
    return <p className="text-sm text-gray-500">No runs yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((i) => {
        const label = i.source === "ci-cd" ? t("table.triggerCi") : t("table.triggerManual");
        const title =
          i.count > 0
            ? `${label}: ${i.passRate}% pass rate over ${i.count} ${t("trends.runs")}${
                i.avgDurationSec != null ? `, avg ${formatDuration(i.avgDurationSec)}` : ""
              }`
            : `${label}: no runs yet`;
        return (
          <div key={i.source} title={title} className="rounded-md border border-surface-border bg-surface-hover/30 p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[i.source] }} />
              <span className="text-xs font-medium text-gray-300">{label}</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">{i.count > 0 ? `${i.passRate}%` : "—"}</p>
            <p className="text-[11px] text-gray-500">
              {i.count} {t("trends.runs")}
              {i.avgDurationSec != null ? ` · ${formatDuration(i.avgDurationSec)} ${t("trends.avgAbbrev")}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Top N longest-running completed runs — flags duration outliers/perf regressions at a glance. */
function SlowestRunsList({
  items,
}: {
  items: { id: number; name: string; runNumber: number; durationSec: number; conclusion: string | null; createdAt: string }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No completed runs yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((run, i) => (
        <li key={run.id}>
          <Link
            href={`/reports/${run.id}`}
            title={`#${run.runNumber} · ${run.name} · ${run.conclusion ?? "?"} · ${formatDuration(run.durationSec)} · ${formatRelativeTime(run.createdAt)}`}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-surface-hover"
          >
            <span className="w-4 shrink-0 text-xs tabular-nums text-gray-500">#{i + 1}</span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${barColor(run.conclusion).split(" ")[0]}`} />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-300">
              {run.name} <span className="text-gray-500">#{run.runNumber}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(run.durationSec)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Newest-first run outcomes as a compact GitHub-Actions-style dot strip. */
function ResultStrip({ recent }: { recent: { id: number; status: string; conclusion: string | null }[] }) {
  const chrono = [...recent].reverse(); // oldest → newest, left to right
  return (
    <div className="flex items-center gap-0.5">
      {chrono.map((r) => (
        <span
          key={r.id}
          title={r.conclusion ?? r.status}
          className={`h-2.5 w-1.5 rounded-sm ${
            r.status !== "completed"
              ? "bg-blue-500/70"
              : r.conclusion === "success"
                ? "bg-emerald-500"
                : r.conclusion === "failure"
                  ? "bg-red-500"
                  : r.conclusion === "cancelled"
                    ? "bg-amber-500/70"
                    : "bg-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function DurationChart({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const series = useMemo(() => durationSeries(runs), [runs]);
  const max = Math.max(1, ...series.map((p) => p.durationSec));
  const avg = series.length
    ? Math.round(series.reduce((s, p) => s + p.durationSec, 0) / series.length)
    : 0;

  if (series.length === 0) {
    return <p className="text-sm text-gray-500">No completed runs to chart yet.</p>;
  }

  return (
    <div>
      <div className="relative h-44">
        {/* duration gridlines + axis labels */}
        {[0, 50, 100].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-surface-border/50" style={{ top: `${g}%` }}>
            <span className="absolute -top-2 left-0 text-[10px] tabular-nums text-gray-600">
              {formatDuration(Math.round((max * (100 - g)) / 100))}
            </span>
          </div>
        ))}

        {/* average reference line */}
        {avg > 0 && (
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-indigo-400/70"
            style={{ top: `${(1 - avg / max) * 100}%` }}
          >
            <span className="absolute -top-2 right-0 rounded bg-surface-panel/80 px-1 text-[10px] font-medium text-indigo-300">
              avg {formatDuration(avg)}
            </span>
          </div>
        )}

        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-px pl-10">
          {series.map((p) => (
            <Link
              key={p.id}
              href={`/reports/${p.id}`}
              title={`#${p.runNumber} · ${p.name} · ${p.conclusion ?? "?"} · ${formatDuration(p.durationSec)} · ${formatRelativeTime(p.createdAt)}`}
              className="group flex flex-1 items-end"
              style={{ minWidth: 3 }}
            >
              <div
                className={`w-full rounded-t-sm transition-all group-hover:brightness-125 ${barColor(p.conclusion)}`}
                style={{ height: `${Math.max(2, (p.durationSec / max) * 100)}%` }}
              />
            </Link>
          ))}
        </div>
      </div>

      {/* outcome legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <LegendDot className="bg-emerald-500/80" label={t("status.passed")} />
        <LegendDot className="bg-red-500/80" label={t("status.failed")} />
        <LegendDot className="bg-amber-500/70" label={t("status.cancelled")} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{formatRelativeTime(series[0].createdAt)}</span>
        <span>{series.length} runs · max {formatDuration(max)}</span>
        <span>{formatRelativeTime(series[series.length - 1].createdAt)}</span>
      </div>
    </div>
  );
}

function PassRateChart({ runs }: { runs: RunSummary[] }) {
  const { series, minT, maxT } = useMemo(() => passRateByProject(runs, 5), [runs]);

  const totalPoints = series.reduce((sum, s) => sum + s.points.length, 0);
  if (totalPoints === 0) {
    return <p className="text-sm text-gray-500">No completed runs to chart yet.</p>;
  }

  // X-axis is per-project run recency (newest run pinned to the right edge),
  // NOT wall-clock time. This way every project renders as its own full line
  // that overlays the others for comparison, instead of being strung
  // end-to-end on a shared timeline (which made them look like one line).
  const maxLen = Math.max(...series.map((s) => s.points.length));
  const step = maxLen > 1 ? 96 / (maxLen - 1) : 0;
  // i = point index within its series (0 = oldest), len = that series' length.
  const xFor = (i: number, len: number) => 98 - (len - 1 - i) * step;
  // Pad the vertical range so 0% / 100% lines aren't clipped against the edges.
  const PAD = 10;
  const yFor = (rate: number) => PAD + (1 - rate) * (100 - 2 * PAD);

  return (
    <div>
      <div className="relative h-44 w-full overflow-hidden rounded-md bg-surface-hover/30">
        {/* gridlines at 100 / 50 / 0% */}
        {[100, 50, 0].map((pct) => (
          <div
            key={pct}
            className="absolute inset-x-0 border-t border-surface-border/60"
            style={{ top: `${yFor(pct / 100)}%` }}
          >
            <span className="absolute -top-2 left-1 text-[10px] text-gray-600">{pct}%</span>
          </div>
        ))}

        {/* one line per project */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {series.map((s, idx) => {
            if (s.points.length < 2) return null;
            const line = s.points
              .map((p, i) => `${xFor(i, s.points.length).toFixed(2)},${yFor(p.rate).toFixed(2)}`)
              .join(" ");
            return (
              <polyline
                key={s.name}
                points={line}
                fill="none"
                stroke={colorFor(idx)}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* round data-point markers (HTML so they aren't distorted by the stretched svg) */}
        {series.map((s, idx) =>
          s.points.map((p, i) => (
            <span
              key={`${s.name}-${p.runNumber}-${p.t}`}
              title={`${s.name} · #${p.runNumber} · ${Math.round(p.rate * 100)}% · ${formatRelativeTime(p.createdAt)}`}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-panel"
              style={{ left: `${xFor(i, s.points.length)}%`, top: `${yFor(p.rate)}%`, backgroundColor: colorFor(idx) }}
            />
          ))
        )}
      </div>

      {/* per-project legend with latest pass rate */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s, idx) => (
          <LegendDot
            key={s.name}
            color={colorFor(idx)}
            label={s.name}
            value={`${Math.round(s.points[s.points.length - 1].rate * 100)}%`}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{formatRelativeTime(new Date(minT).toISOString())}</span>
        <span>5-run trailing pass rate</span>
        <span>{formatRelativeTime(new Date(maxT).toISOString())}</span>
      </div>
    </div>
  );
}

function SuiteTable({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const suites = useMemo(() => suiteBreakdown(runs), [runs]);

  if (suites.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        No completed runs to break down yet.
      </div>
    );
  }

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
            <th className="px-4 py-3">{t("trends.recent")}</th>
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
                <div
                  className="flex items-center gap-2"
                  title={`${s.passRate}% pass rate — ${s.passed} passed, ${s.failed} failed of ${s.completed} completed`}
                >
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
              <td className="px-4 py-3">
                <ResultStrip recent={s.recent} />
              </td>
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

// Shared body for every tab: Overview passes no `type` (and gets the extra
// run-mix/trigger-mix charts, since those only make sense across all types
// combined); each type tab passes its filtered runs + type and is worded
// around k6 thresholds instead of generic "pass/fail" when type is "load".
function StatsSection({ runs, type }: { runs: RunSummary[]; type?: RunSummary["runType"] }) {
  const { t } = useI18n();
  const summary = useMemo(() => trendSummary(runs), [runs]);
  const statusCounts = useMemo(() => statusBreakdown(runs), [runs]);
  const slowest = useMemo(() => slowestRuns(runs, 5), [runs]);
  const triggerComparison = useMemo(() => triggerSourceComparison(runs), [runs]);
  const typeMix = useMemo(() => runTypeBreakdown(runs), [runs]);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        {type ? t("trends.noRunsForType") : "No runs yet to build trends from."}
      </div>
    );
  }

  const passRateLabel = type === "load" ? t("suiteTests.thresholdPassRate") : t("trends.passRate");
  const passRateChartTitle = type === "load" ? t("trends.thresholdPassRateChart") : t("trends.passRateChart");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={passRateLabel} value={`${summary.passRate}%`} hint={`${summary.completedRuns} ✓`} />
        <Kpi label={t("trends.failRate")} value={`${100 - summary.passRate}%`} />
        <Kpi
          label={t("trends.avgDuration")}
          value={summary.avgDurationSec != null ? formatDuration(summary.avgDurationSec) : "—"}
        />
        <Kpi
          label={t("trends.medianDuration")}
          value={summary.medianDurationSec != null ? formatDuration(summary.medianDurationSec) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("trends.durationChart")}>
          <DurationChart runs={runs} />
        </ChartCard>
        <ChartCard title={passRateChartTitle}>
          <PassRateChart runs={runs} />
        </ChartCard>
      </div>

      <ChartCard title={t("trends.statusBreakdown")}>
        <MixBar
          items={statusCounts
            .filter((s) => s.bucket !== "other" || s.count > 0)
            .map((s) => ({
              label: t(
                s.bucket === "passed"
                  ? "status.passed"
                  : s.bucket === "failed"
                    ? "status.failed"
                    : s.bucket === "cancelled"
                      ? "status.cancelled"
                      : "trends.other"
              ),
              count: s.count,
              color: STATUS_COLORS[s.bucket],
            }))}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("trends.triggerComparison")}>
          <TriggerComparisonCards items={triggerComparison} />
          {!type && (
            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-300">{t("trends.runMix")}</h4>
              <MixBar
                items={typeMix.map((m) => ({
                  label: t(TYPE_LABEL_KEYS[m.type]),
                  count: m.count,
                  color: TYPE_COLORS[m.type],
                }))}
              />
            </div>
          )}
        </ChartCard>
        <ChartCard title={t("trends.slowestRuns")}>
          <SlowestRunsList items={slowest} />
        </ChartCard>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("trends.bySuite")}</h3>
        <SuiteTable runs={runs} />
      </div>
    </div>
  );
}

const SECTION_TABS = [
  { key: "overview", labelKey: "trends.tabOverview" },
  { key: "frontend", labelKey: "suite.frontend" },
  { key: "api", labelKey: "suite.api" },
  { key: "load", labelKey: "suite.load" },
] as const;
type SectionKey = (typeof SECTION_TABS)[number]["key"];

export function TrendsView({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const [section, setSection] = useState<SectionKey>("overview");

  const frontendRuns = useMemo(() => runs.filter((r) => r.runType === "frontend"), [runs]);
  const apiRuns = useMemo(() => runs.filter((r) => r.runType === "api"), [runs]);
  const loadRuns = useMemo(() => runs.filter((r) => r.runType === "load"), [runs]);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        No runs yet to build trends from.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-surface-border">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            className={[
              "px-4 py-2 text-sm font-medium transition",
              section === tab.key
                ? "border-b-2 border-indigo-500 text-white"
                : "border-b-2 border-transparent text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {section === "overview" && <StatsSection runs={runs} />}
      {section === "frontend" && <StatsSection runs={frontendRuns} type="frontend" />}
      {section === "api" && <StatsSection runs={apiRuns} type="api" />}
      {section === "load" && <StatsSection runs={loadRuns} type="load" />}
    </div>
  );
}
