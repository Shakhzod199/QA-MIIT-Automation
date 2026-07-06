"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { TriggerSourceBadge } from "@/components/TriggerSourceBadge";
import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import {
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
  frontend: "#8b5cf6",
  api: "#2dd4bf",
  load: "#ff5fa2",
  security: "#f5b544",
};
const TYPE_LABEL_KEYS: Record<RunSummary["runType"], string> = {
  frontend: "suite.frontend",
  api: "suite.api",
  load: "suite.load",
  security: "suite.security",
};
// Matches TriggerSourceBadge.
const SOURCE_COLORS: Record<RunSummary["triggerSource"], string> = {
  manual: "#5b636e",
  "ci-cd": "#8b5cf6",
};
// Matches StatusBadge (components/RunsTable.tsx).
const STATUS_COLORS = {
  passed: "#3ddc97",
  failed: "#ff5d5d",
  cancelled: "#f5b544",
  other: "#5b636e",
} as const;

function barColor(conclusion: string | null): string {
  if (conclusion === "success") return "bg-q-green/80 hover:bg-q-green";
  if (conclusion === "failure") return "bg-q-red/80 hover:bg-q-red";
  if (conclusion === "cancelled") return "bg-q-amber/70 hover:bg-q-amber";
  return "bg-[#5b636e] hover:bg-[#8a93a0]";
}

// Stable per-project line colors (cycles if there are more projects than colors).
const PROJECT_COLORS = ["#3ddc97", "#8b5cf6", "#5b9dff", "#f5b544", "#ff5fa2", "#2dd4bf", "#ff5d5d", "#e8ecf1"];
const colorFor = (index: number) => PROJECT_COLORS[index % PROJECT_COLORS.length];

function LegendDot({ color, className, label, value }: { color?: string; className?: string; label: string; value?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-2.5 w-2.5 rounded-sm ${className ?? ""}`} style={color ? { backgroundColor: color } : undefined} />
      <span className="text-q-sub">{label}</span>
      {value && <span className="font-mono tabular-nums text-q-dim">{value}</span>}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[12px] border border-surface-border bg-surface-panel p-4">
      <p className="text-[12px] font-medium text-q-muted">{label}</p>
      <p className="mt-2 text-[30px] font-bold leading-none tracking-[-1px] text-q-text">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-q-dim">{hint}</p>}
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

/**
 * Per-suite view of who started the runs: a strip of the recent runs colored
 * by trigger source (oldest → newest) plus a badge for how the *latest* run
 * was started — answers "was this project last run by CI/CD or by hand?"
 * without opening each suite.
 */
function TriggerBySuite({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const suites = useMemo(() => suiteBreakdown(runs), [runs]);

  if (suites.length === 0) {
    return <p className="text-sm text-gray-500">No runs yet.</p>;
  }

  return (
    <div>
      {/* Two columns: each row's content is short, so full-width rows left a
          long empty stretch between the strip and the counts. */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-2.5 xl:grid-cols-2">
        {suites.map((s) => (
          <div key={s.workflowId} className="flex items-center gap-3">
            <Link
              href={`/suites/${s.workflowId}`}
              className="w-[128px] shrink-0 truncate rounded-[6px] px-2 py-0.5 font-mono text-xs text-q-green transition-colors hover:bg-[rgba(61,220,151,0.18)]"
              style={{ background: "rgba(61,220,151,0.1)" }}
            >
              {s.name}
            </Link>
            {/* Recent runs oldest → newest, colored by who triggered them. */}
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              {[...s.recent].reverse().map((r) => (
                <span
                  key={r.id}
                  title={`Run #${r.runNumber} · ${
                    r.triggerSource === "ci-cd" ? t("table.triggerCi") : t("table.triggerManual")
                  } · ${formatDateTime(r.createdAt)}`}
                  className="h-2.5 w-1.5 rounded-sm"
                  style={{ background: SOURCE_COLORS[r.triggerSource] }}
                />
              ))}
            </div>
            <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-q-dim sm:inline">
              {s.manualCount} {t("table.triggerManual")} · {s.cicdCount} {t("table.triggerCi")}
            </span>
            {s.lastTriggerSource && (
              <TriggerSourceBadge source={s.lastTriggerSource} title={t("trends.lastRunTrigger")} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <LegendDot color={SOURCE_COLORS.manual} label={t("table.triggerManual")} />
        <LegendDot color={SOURCE_COLORS["ci-cd"]} label={t("table.triggerCi")} />
        <span className="text-[11px] text-q-dim">{t("trends.lastRunTriggerHint")}</span>
      </div>
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
function ResultStrip({
  recent,
}: {
  recent: {
    id: number;
    status: string;
    conclusion: string | null;
    runNumber: number;
    createdAt: string;
    testFilter: string | null;
    triggerSource: RunSummary["triggerSource"];
  }[];
}) {
  const chrono = [...recent].reverse(); // oldest → newest, left to right
  return (
    <div className="flex items-center gap-0.5">
      {chrono.map((r) => (
        <span
          key={r.id}
          title={`Run #${r.runNumber} · ${getStatusBadge(r.status, r.conclusion).label} · ${
            r.triggerSource === "ci-cd" ? "CI/CD" : "Manual"
          } · ${formatDateTime(r.createdAt)} · ${r.testFilter ?? "Full suite"}`}
          className={`h-2.5 w-1.5 rounded-sm ${
            r.status !== "completed"
              ? "bg-[#5b9dff]/70"
              : r.conclusion === "success"
                ? "bg-q-green"
                : r.conclusion === "failure"
                  ? "bg-q-red"
                  : r.conclusion === "cancelled"
                    ? "bg-q-amber/70"
                    : "bg-[#5b636e]"
          }`}
        />
      ))}
    </div>
  );
}

/** Shared SVG line chart — renders per-project polylines with grid lines and axis labels. */
function LineChart({
  title,
  series,
  yMaxLabel,
  yMinLabel,
}: {
  title: string;
  series: { name: string; color: string; points: number[] }[];
  yMaxLabel: string;
  yMinLabel: string;
}) {
  const allVals = series.flatMap((s) => s.points);
  const maxVal = Math.max(1, ...allVals);

  const toPoints = (values: number[]) => {
    const n = values.length;
    if (n < 2) return "";
    return values
      .map((v, i) => {
        const x = ((i / (n - 1)) * 556 + 2).toFixed(1);
        const y = (14 + (1 - v / maxVal) * 142).toFixed(1);
        return `${x},${y}`;
      })
      .join(" ");
  };

  return (
    <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[13px] font-semibold text-q-text">{title}</div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10.5px]">
          {series.map((s) => (
            <span key={s.name} style={{ color: s.color }}>● {s.name}</span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 560 170" className="mt-2.5 block h-[160px] w-full" preserveAspectRatio="none">
        {[15, 62, 109, 156].map((y) => (
          <line key={y} x1="0" y1={y} x2="560" y2={y} stroke="rgba(255,255,255,0.05)" />
        ))}
        {series.map((s) => (
          <polyline
            key={s.name}
            points={toPoints(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-q-dim">
        <span>{yMaxLabel}</span>
        <span>run index →</span>
        <span>{yMinLabel}</span>
      </div>
    </div>
  );
}

function DurationLineChart({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const chartSeries = useMemo(() => {
    const completed = runs.filter((r) => r.status === "completed" && r.durationSec != null);
    const byName = new Map<string, number[]>();
    for (const r of [...completed].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )) {
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name)!.push(r.durationSec as number);
    }
    // Sorted by name so a project keeps the same color as in the pass-rate
    // chart next to this one (which also assigns colors alphabetically).
    return Array.from(byName.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, points], idx) => ({ name, color: colorFor(idx), points: points.slice(-10) }))
      .filter((s) => s.points.length >= 2);
  }, [runs]);

  if (chartSeries.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
        <p className="text-[13px] font-semibold text-q-text">{t("trends.durationChart")}</p>
        <p className="mt-8 text-center text-[13px] text-q-muted">No completed runs yet.</p>
      </div>
    );
  }

  const maxDur = Math.max(...chartSeries.flatMap((s) => s.points));
  return (
    <LineChart
      title={t("trends.durationChart")}
      series={chartSeries}
      yMaxLabel={formatDuration(Math.round(maxDur))}
      yMinLabel="0s"
    />
  );
}

function PassRateLineChart({ runs, title }: { runs: RunSummary[]; title: string }) {
  const { series } = useMemo(() => passRateByProject(runs, 10), [runs]);
  // Color by position in the full (alphabetical) list, then filter — so a
  // project keeps its color even when another project drops below 2 points.
  const chartSeries = series
    .map((s, idx) => ({
      name: s.name,
      color: colorFor(idx),
      points: s.points.map((p) => p.rate * 100),
    }))
    .filter((s) => s.points.length >= 2);

  if (chartSeries.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
        <p className="text-[13px] font-semibold text-q-text">{title}</p>
        <p className="mt-8 text-center text-[13px] text-q-muted">No completed runs yet.</p>
      </div>
    );
  }
  return <LineChart title={title} series={chartSeries} yMaxLabel="100%" yMinLabel="0%" />;
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
      <div className="border-b border-surface-border px-4 py-3 text-[13px] font-semibold text-q-text">
        {t("trends.bySuite")}
      </div>
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
                <Link
                  href={`/suites/${s.workflowId}`}
                  className="rounded-[6px] px-2 py-0.5 font-mono text-xs text-q-green transition-colors hover:bg-[rgba(61,220,151,0.18)]"
                  style={{ background: "rgba(61,220,151,0.1)" }}
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-300">{s.total}</td>
              <td className="px-4 py-3">
                <div
                  className="flex items-center gap-2"
                  title={`${s.passRate}% pass rate — ${s.passed} passed, ${s.failed} failed of ${s.completed} completed`}
                >
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-border">
                    <div
                      className={`h-full rounded-full ${s.passRate >= 80 ? "bg-q-green" : s.passRate >= 50 ? "bg-q-amber" : "bg-q-red"}`}
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
    <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
      <h3 className="mb-4 text-[13px] font-semibold text-q-text">{title}</h3>
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
  // Real fail rate (failed / completed). "100 − pass rate" would wrongly
  // count cancelled runs as failures.
  const failRate = useMemo(() => {
    const completed = runs.filter((r) => r.status === "completed");
    if (completed.length === 0) return 0;
    const failed = completed.filter((r) => r.conclusion === "failure").length;
    return Math.round((failed / completed.length) * 100);
  }, [runs]);
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
    <div className="space-y-[14px]">
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <Kpi label={passRateLabel} value={`${summary.passRate}%`} hint={`${summary.completedRuns} completed`} />
        <Kpi label={t("trends.failRate")} value={`${failRate}%`} />
        <Kpi
          label={t("trends.avgDuration")}
          value={summary.avgDurationSec != null ? formatDuration(summary.avgDurationSec) : "—"}
        />
        <Kpi
          label={t("trends.medianDuration")}
          value={summary.medianDurationSec != null ? formatDuration(summary.medianDurationSec) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
        <PassRateLineChart runs={runs} title={passRateChartTitle} />
        <DurationLineChart runs={runs} />
      </div>

      {/* Short cards share one row instead of each spanning the full width. */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-3">
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
        <ChartCard title={t("trends.triggerComparison")}>
          <TriggerComparisonCards items={triggerComparison} />
        </ChartCard>
        <ChartCard title={t("trends.slowestRuns")}>
          <SlowestRunsList items={slowest} />
        </ChartCard>
      </div>

      <ChartCard title={t("trends.triggerBySuite")}>
        <TriggerBySuite runs={runs} />
      </ChartCard>

      <SuiteTable runs={runs} />
    </div>
  );
}

const SECTION_TABS = [
  { key: "overview", labelKey: "trends.tabOverview" },
  { key: "frontend", labelKey: "suite.frontend" },
  { key: "api", labelKey: "suite.api" },
  { key: "load", labelKey: "suite.load" },
  { key: "security", labelKey: "suite.security" },
] as const;
type SectionKey = (typeof SECTION_TABS)[number]["key"];

export function TrendsView({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const [section, setSection] = useState<SectionKey>("overview");

  const frontendRuns = useMemo(() => runs.filter((r) => r.runType === "frontend"), [runs]);
  const apiRuns = useMemo(() => runs.filter((r) => r.runType === "api"), [runs]);
  const loadRuns = useMemo(() => runs.filter((r) => r.runType === "load"), [runs]);
  const securityRuns = useMemo(() => runs.filter((r) => r.runType === "security"), [runs]);

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
                ? "border-b-2 border-[#3ddc97] text-q-text"
                : "border-b-2 border-transparent text-q-muted hover:text-q-sub",
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
      {section === "security" && <StatsSection runs={securityRuns} type="security" />}
    </div>
  );
}
