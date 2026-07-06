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
  workflowId: number;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  passRate: number; // 0..100
  avgDurationSec: number | null;
  lastRunAt: string | null;
  /** How the suite's most recent run was started, null when the suite has no runs. */
  lastTriggerSource: RunSummary["triggerSource"] | null;
  /** Runs in this window started from the dashboard. */
  manualCount: number;
  /** Runs in this window started by an automated caller (e.g. deploy pipeline). */
  cicdCount: number;
  /** Newest-first, capped at 12 — for a GitHub-style recent-results strip. */
  recent: {
    id: number;
    status: string;
    conclusion: string | null;
    runNumber: number;
    createdAt: string;
    /** Playwright filter for a single-test run, else null = full suite. */
    testFilter: string | null;
    triggerSource: RunSummary["triggerSource"];
  }[];
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
      workflowId: list[0].workflowId,
      total: list.length,
      completed: completed.length,
      passed,
      failed,
      passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
      avgDurationSec: avg,
      lastRunAt: list[0]?.createdAt ?? null,
      lastTriggerSource: list[0]?.triggerSource ?? null,
      manualCount: list.filter((r) => r.triggerSource === "manual").length,
      cicdCount: list.filter((r) => r.triggerSource === "ci-cd").length,
      // Newest-first, capped — just enough for a GitHub-style result strip.
      recent: list.slice(0, 12).map((r) => ({
        id: r.id,
        status: r.status,
        conclusion: r.conclusion,
        runNumber: r.runNumber,
        createdAt: r.createdAt,
        testFilter: r.testFilter,
        triggerSource: r.triggerSource,
      })),
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
