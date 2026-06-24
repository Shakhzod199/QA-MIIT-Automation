export interface WorkflowSummary {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
}

export interface RunSummary {
  id: number;
  name: string;
  runNumber: number;
  workflowId: number;
  status: string; // "queued" | "in_progress" | "completed"
  conclusion: string | null; // "success" | "failure" | "cancelled" | null
  branch: string | null;
  createdAt: string;
  durationSec: number | null;
  htmlUrl: string;
  /** Playwright filter for a single-test run (from run-name), else null = full suite. */
  testFilter: string | null;
  /** Test type dispatched (from run-name); defaults to "frontend" when absent (older runs). */
  runType: "frontend" | "api" | "load";
}

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  completed: number;
  passRate: number;
  failRate: number;
  lastRunAt: string | null;
}

export interface WorkflowsResponse {
  configured: boolean;
  workflows: WorkflowSummary[];
  error?: string;
}

export interface RunsResponse {
  configured: boolean;
  runs: RunSummary[];
  stats: RunStats;
  error?: string;
}

export interface TriggerResponse {
  ok: boolean;
  error?: string;
}

export interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  durationSec: number | null;
}

export interface JobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  durationSec: number | null;
  htmlUrl: string;
  steps: JobStep[];
}

export interface ArtifactSummary {
  id: number;
  name: string;
  sizeInBytes: number;
  expired: boolean;
}

export interface RunDetail extends RunSummary {
  event: string;
  actor: string | null;
  updatedAt: string;
}

export interface RunDetailResponse {
  configured: boolean;
  run?: RunDetail;
  jobs: JobSummary[];
  artifacts: ArtifactSummary[];
  error?: string;
}

export type TestStatus = "passed" | "failed" | "timedOut" | "flaky" | "skipped";

export interface TestCaseResult {
  /** describe-block titles leading to the test, e.g. ["Login", "rejects bad password"]. */
  titlePath: string[];
  file: string;
  line: number;
  project: string;
  status: TestStatus;
  durationMs: number;
  /** Number of retry attempts beyond the first (0 = passed first try). */
  retries: number;
  /** ANSI-stripped error message for failing/flaky tests, else null. */
  error: string | null;
}

export interface TestReportSummary {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

export interface TestReportResponse {
  configured: boolean;
  /** True when a parseable Playwright JSON report was found for this run. */
  available: boolean;
  summary: TestReportSummary;
  tests: TestCaseResult[];
  error?: string;
}

export interface FlakyTestRun {
  runId: number;
  runNumber: number;
  createdAt: string;
  status: TestStatus;
}

export interface FlakyTest {
  key: string;
  titlePath: string[];
  file: string;
  project: string;
  /** How many analyzed runs this test appeared in. */
  appearances: number;
  passed: number;
  /** Includes timed-out. */
  failed: number;
  /** Playwright-flagged flaky (failed then passed on retry). */
  flaky: number;
  skipped: number;
  /** 0..1 flakiness score; higher = flakier. */
  flakeRate: number;
  /** Per-run outcomes, newest first. */
  history: FlakyTestRun[];
}

export interface FlakyResponse {
  configured: boolean;
  /** Number of runs actually parsed (have a results.json artifact). */
  runsAnalyzed: number;
  /** Window size requested by the client. */
  windowRequested: number;
  generatedAt: string;
  tests: FlakyTest[];
  error?: string;
}
