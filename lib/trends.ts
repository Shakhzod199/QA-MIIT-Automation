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
    });
  }
  return out.sort((a, b) => b.total - a.total);
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
