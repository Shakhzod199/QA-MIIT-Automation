import type { RunStats, RunSummary } from "@/lib/types";

export function emptyStats(): RunStats {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    completed: 0,
    passRate: 0,
    failRate: 0,
    lastRunAt: null,
  };
}

export function computeStats(runs: RunSummary[]): RunStats {
  if (runs.length === 0) return emptyStats();

  let passed = 0;
  let failed = 0;
  let completed = 0;

  for (const run of runs) {
    if (run.status !== "completed") continue;
    completed += 1;
    if (run.conclusion === "success") passed += 1;
    else if (run.conclusion === "failure") failed += 1;
  }

  return {
    total: runs.length,
    passed,
    failed,
    completed,
    passRate: completed > 0 ? Math.round((passed / completed) * 100) : 0,
    failRate: completed > 0 ? Math.round((failed / completed) * 100) : 0,
    lastRunAt: runs[0]?.createdAt ?? null,
  };
}
