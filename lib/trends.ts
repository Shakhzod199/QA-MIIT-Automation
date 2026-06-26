import type { RunSummary } from "@/lib/types";

export interface DurationPoint {
  id: number;
  runNumber: number;
  name: string;
  createdAt: string;
  durationSec: number;
  conclusion: string | null;
}

export interface SuiteTrend {
  name: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  passRate: number; // 0..100
  avgDurationSec: number | null;
  lastRunAt: string | null;
  /** Newest-first, capped at 12 — for a GitHub-style recent-results strip. */
  recent: { id: number; status: string; conclusion: string | null }[];
}

export interface TrendSummary {
  completedRuns: number;
  passRate: number; // 0..100
  avgDurationSec: number | null;
  medianDurationSec: number | null;
}

/** Completed runs in chronological order (oldest → newest) with a numeric duration. */
export function durationSeries(runs: RunSummary[]): DurationPoint[] {
  return runs
    .filter((r) => r.status === "completed")
    .map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      name: r.name,
      createdAt: r.createdAt,
      durationSec: r.durationSec ?? 0,
      conclusion: r.conclusion,
    }))
    .reverse();
}

export interface ProjectPassRatePoint {
  t: number; // epoch ms of the run
  rate: number; // trailing pass rate at this point, 0..1
  createdAt: string;
  runNumber: number;
}

export interface ProjectPassRateSeries {
  name: string;
  points: ProjectPassRatePoint[];
}

export interface PassRateByProject {
  series: ProjectPassRateSeries[];
  minT: number;
  maxT: number;
}

/**
 * Trailing pass rate per project, plotted on a shared time axis so each
 * project becomes its own line in a multi-series chart (oldest → newest).
 */
export function passRateByProject(runs: RunSummary[], window = 5): PassRateByProject {
  const groups = new Map<string, RunSummary[]>();
  for (const run of runs) {
    if (run.status !== "completed") continue;
    if (!groups.has(run.name)) groups.set(run.name, []);
    groups.get(run.name)!.push(run);
  }

  const series: ProjectPassRateSeries[] = [];
  let minT = Infinity;
  let maxT = -Infinity;

  for (const [name, list] of groups) {
    const chrono = [...list].reverse(); // oldest → newest
    const points: ProjectPassRatePoint[] = [];
    for (let i = 0; i < chrono.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = chrono.slice(start, i + 1);
      const passed = slice.filter((r) => r.conclusion === "success").length;
      const t = Date.parse(chrono[i].createdAt);
      points.push({ t, rate: passed / slice.length, createdAt: chrono[i].createdAt, runNumber: chrono[i].runNumber });
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    if (points.length) series.push({ name, points });
  }

  // Stable ordering by name keeps each project's color assignment consistent.
  series.sort((a, b) => a.name.localeCompare(b.name));

  return {
    series,
    minT: Number.isFinite(minT) ? minT : 0,
    maxT: Number.isFinite(maxT) ? maxT : 0,
  };
}

export function suiteBreakdown(runs: RunSummary[]): SuiteTrend[] {
  const groups = new Map<string, RunSummary[]>();
  for (const run of runs) {
    if (!groups.has(run.name)) groups.set(run.name, []);
    groups.get(run.name)!.push(run);
  }

  const out: SuiteTrend[] = [];
  for (const [name, list] of groups) {
    const completed = list.filter((r) => r.status === "completed");
    const passed = completed.filter((r) => r.conclusion === "success").length;
    const failed = completed.filter((r) => r.conclusion === "failure").length;
    const durations = completed.map((r) => r.durationSec ?? 0).filter((d) => d > 0);
    const avg = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;
    out.push({
      name,
      total: list.length,
      completed: completed.length,
      passed,
      failed,
      passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
      avgDurationSec: avg,
      lastRunAt: list[0]?.createdAt ?? null,
      // Newest-first, capped — just enough for a GitHub-style result strip.
      recent: list.slice(0, 12).map((r) => ({ id: r.id, status: r.status, conclusion: r.conclusion })),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export interface StatusCount {
  bucket: "passed" | "failed" | "cancelled" | "other";
  count: number;
}

/** Outcome breakdown across every run in the window (not just completed ones). */
export function statusBreakdown(runs: RunSummary[]): StatusCount[] {
  const counts: Record<StatusCount["bucket"], number> = { passed: 0, failed: 0, cancelled: 0, other: 0 };
  for (const run of runs) {
    if (run.status === "completed" && run.conclusion === "success") counts.passed += 1;
    else if (run.status === "completed" && run.conclusion === "failure") counts.failed += 1;
    else if (run.status === "completed" && run.conclusion === "cancelled") counts.cancelled += 1;
    else counts.other += 1;
  }
  return (["passed", "failed", "cancelled", "other"] as const).map((bucket) => ({ bucket, count: counts[bucket] }));
}

export interface DurationBucket {
  label: string;
  count: number;
}

/** Buckets completed runs' durations into 5 equal-width bins for a histogram. */
export function durationHistogram(runs: RunSummary[], bins = 5): DurationBucket[] {
  const durations = runs
    .filter((r) => r.status === "completed" && r.durationSec != null && r.durationSec > 0)
    .map((r) => r.durationSec as number);
  if (durations.length === 0) return [];

  const max = Math.max(...durations);
  const width = max / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const d of durations) {
    const idx = Math.min(bins - 1, Math.floor(d / width));
    counts[idx] += 1;
  }

  return counts.map((count, i) => {
    const lo = Math.round(i * width);
    const hi = Math.round((i + 1) * width);
    return { label: `${formatShort(lo)}–${formatShort(hi)}`, count };
  });
}

function formatShort(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}

export interface SlowRun {
  id: number;
  name: string;
  runNumber: number;
  durationSec: number;
  conclusion: string | null;
  createdAt: string;
}

/** The N longest-running completed runs, slowest first — useful for spotting perf regressions. */
export function slowestRuns(runs: RunSummary[], limit = 5): SlowRun[] {
  return runs
    .filter((r) => r.status === "completed" && r.durationSec != null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      runNumber: r.runNumber,
      durationSec: r.durationSec as number,
      conclusion: r.conclusion,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, limit);
}

export interface TriggerComparison {
  source: RunSummary["triggerSource"];
  count: number;
  passRate: number;
  avgDurationSec: number | null;
}

/** Pass rate + avg duration split by who started the run — are CI/CD runs as reliable as manual ones? */
export function triggerSourceComparison(runs: RunSummary[]): TriggerComparison[] {
  return (["manual", "ci-cd"] as const).map((source) => {
    const subset = runs.filter((r) => r.triggerSource === source);
    const s = trendSummary(subset);
    return { source, count: subset.length, passRate: s.passRate, avgDurationSec: s.avgDurationSec };
  });
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  total: number;
  passed: number;
  failed: number;
  other: number;
}

/** Run volume per calendar day (oldest → newest) — how active is this suite/window. */
export function runsPerDay(runs: RunSummary[]): DailyActivity[] {
  const groups = new Map<string, DailyActivity>();
  for (const run of runs) {
    const date = run.createdAt.slice(0, 10);
    if (!groups.has(date)) groups.set(date, { date, total: 0, passed: 0, failed: 0, other: 0 });
    const g = groups.get(date)!;
    g.total += 1;
    if (run.status === "completed" && run.conclusion === "success") g.passed += 1;
    else if (run.status === "completed" && run.conclusion === "failure") g.failed += 1;
    else g.other += 1;
  }
  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface RunTypeCount {
  type: RunSummary["runType"];
  count: number;
}

/** How many runs of each test type (frontend/api/load) are in this window. */
export function runTypeBreakdown(runs: RunSummary[]): RunTypeCount[] {
  const counts: Record<RunSummary["runType"], number> = { frontend: 0, api: 0, load: 0 };
  for (const run of runs) counts[run.runType] += 1;
  return (["frontend", "api", "load"] as const).map((type) => ({ type, count: counts[type] }));
}

export interface TriggerSourceCount {
  source: RunSummary["triggerSource"];
  count: number;
}

/** How many runs were started manually (dashboard) vs by an automated caller (CI/CD). */
export function triggerSourceBreakdown(runs: RunSummary[]): TriggerSourceCount[] {
  const counts: Record<RunSummary["triggerSource"], number> = { manual: 0, "ci-cd": 0 };
  for (const run of runs) counts[run.triggerSource] += 1;
  return (["manual", "ci-cd"] as const).map((source) => ({ source, count: counts[source] }));
}

export function trendSummary(runs: RunSummary[]): TrendSummary {
  const completed = runs.filter((r) => r.status === "completed");
  const passed = completed.filter((r) => r.conclusion === "success").length;
  const durations = completed
    .map((r) => r.durationSec ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);

  const avg = durations.length
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null;
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;

  return {
    completedRuns: completed.length,
    passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
    avgDurationSec: avg,
    medianDurationSec: median,
  };
}
