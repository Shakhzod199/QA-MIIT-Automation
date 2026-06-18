import type { FlakyTest, TestCaseResult } from "@/lib/types";

export interface RunTests {
  runId: number;
  runNumber: number;
  createdAt: string;
  tests: TestCaseResult[];
}

function testKey(t: TestCaseResult): string {
  return `${t.file}::${t.titlePath.join(" › ")}::${t.project}`;
}

/**
 * Aggregates per-test outcomes across multiple runs and returns only the
 * tests that look flaky — i.e. Playwright marked them flaky (retry-pass) at
 * least once, OR they have both passing and failing results in the window.
 *
 * A consistently failing test is NOT flaky (it's just broken), so it is
 * excluded. Runs must be passed newest-first so each test's history reads
 * newest-first.
 */
export function aggregateFlaky(runs: RunTests[]): FlakyTest[] {
  const map = new Map<string, FlakyTest>();

  for (const run of runs) {
    for (const t of run.tests) {
      const key = testKey(t);
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          titlePath: t.titlePath,
          file: t.file,
          project: t.project,
          appearances: 0,
          passed: 0,
          failed: 0,
          flaky: 0,
          skipped: 0,
          flakeRate: 0,
          history: [],
        };
        map.set(key, agg);
      }

      agg.appearances += 1;
      if (t.status === "passed") agg.passed += 1;
      else if (t.status === "flaky") agg.flaky += 1;
      else if (t.status === "skipped") agg.skipped += 1;
      else agg.failed += 1; // failed | timedOut

      agg.history.push({
        runId: run.runId,
        runNumber: run.runNumber,
        createdAt: run.createdAt,
        status: t.status,
      });
    }
  }

  const result: FlakyTest[] = [];
  for (const agg of map.values()) {
    const isFlaky = agg.flaky > 0 || (agg.passed > 0 && agg.failed > 0);
    if (!isFlaky) continue;

    // Retry-flakes plus the size of the minority outcome (a 5-pass/5-fail test
    // is far flakier than 9-pass/1-fail), normalized by appearances.
    agg.flakeRate =
      (agg.flaky + Math.min(agg.passed, agg.failed)) / Math.max(1, agg.appearances);
    result.push(agg);
  }

  result.sort((a, b) => b.flakeRate - a.flakeRate || b.flaky - a.flaky || b.appearances - a.appearances);
  return result;
}
