import type {
  TestCaseResult,
  TestReportSummary,
  TestStatus,
} from "@/lib/types";

// Minimal shape of the Playwright JSON reporter output we rely on. The real
// payload has far more, but these are the stable fields we read.
interface PwResult {
  status?: string; // "passed" | "failed" | "timedOut" | "skipped" | "interrupted"
  duration?: number;
  retry?: number;
  error?: { message?: string };
  errors?: { message?: string }[];
}
interface PwTest {
  projectName?: string;
  status?: string; // "expected" | "unexpected" | "flaky" | "skipped"
  results?: PwResult[];
}
interface PwSpec {
  title: string;
  file?: string;
  line?: number;
  tests?: PwTest[];
}
interface PwSuite {
  title?: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  suites?: PwSuite[];
  stats?: { duration?: number };
}

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI, "");
}

function mapStatus(test: PwTest): TestStatus {
  switch (test.status) {
    case "flaky":
      return "flaky";
    case "skipped":
      return "skipped";
    case "expected":
      return "passed";
    case "unexpected": {
      // Distinguish a timeout from a plain assertion failure for clearer triage.
      const last = test.results?.[test.results.length - 1];
      return last?.status === "timedOut" ? "timedOut" : "failed";
    }
    default:
      return "failed";
  }
}

function extractError(test: PwTest): string | null {
  for (const result of test.results ?? []) {
    if (result.status === "passed" || result.status === "skipped") continue;
    const msg = result.error?.message ?? result.errors?.[0]?.message;
    if (msg) return stripAnsi(msg).trim();
  }
  return null;
}

/** Recursively walks the suite tree, accumulating one row per spec/test. */
function walk(
  suites: PwSuite[],
  titlePrefix: string[],
  out: TestCaseResult[]
): void {
  for (const suite of suites) {
    // A suite's own title may be the file path (top level) or a describe block
    // (nested). We only push describe titles into the path, not the file path.
    const isFileSuite = Boolean(suite.file) && suite.title === suite.file;
    const nextPrefix =
      suite.title && !isFileSuite ? [...titlePrefix, suite.title] : titlePrefix;

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const last = results[results.length - 1];
        out.push({
          titlePath: [...nextPrefix, spec.title],
          file: spec.file ?? suite.file ?? "",
          line: spec.line ?? 0,
          project: test.projectName ?? "",
          status: mapStatus(test),
          durationMs: last?.duration ?? 0,
          retries: Math.max(0, ...results.map((r) => r.retry ?? 0)),
          error: extractError(test),
        });
      }
    }

    if (suite.suites?.length) walk(suite.suites, nextPrefix, out);
  }
}

export interface ParsedReport {
  summary: TestReportSummary;
  tests: TestCaseResult[];
}

/** Parses raw Playwright JSON reporter output into flat, UI-ready test rows. */
export function parsePlaywrightReport(raw: string): ParsedReport | null {
  let report: PwReport;
  try {
    report = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(report.suites)) return null;

  const tests: TestCaseResult[] = [];
  walk(report.suites, [], tests);

  const summary: TestReportSummary = {
    total: tests.length,
    passed: tests.filter((t) => t.status === "passed").length,
    failed: tests.filter((t) => t.status === "failed" || t.status === "timedOut").length,
    flaky: tests.filter((t) => t.status === "flaky").length,
    skipped: tests.filter((t) => t.status === "skipped").length,
    durationMs:
      report.stats?.duration ?? tests.reduce((sum, t) => sum + t.durationMs, 0),
  };

  return { summary, tests };
}
