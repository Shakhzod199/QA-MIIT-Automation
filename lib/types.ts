import type { Locale } from "@/lib/i18n";

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
  runType: "frontend" | "api" | "load" | "security";
  /** Who started the run (from run-name's " (CI/CD)" marker): the dashboard ("manual") or an automated caller like the GitLab deploy pipeline ("ci-cd"). */
  triggerSource: "manual" | "ci-cd";
  /** GitHub login of whoever triggered the run, if known. */
  actor: string | null;
  /** GitHub event that started the run, e.g. "push", "workflow_dispatch", "schedule". */
  event: string;
  /** First line of the triggering commit message, if available. */
  commitMessage: string | null;
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
  /** ANSI-stripped stack trace for the failure, else null. */
  stack: string | null;
  /** Source excerpt around the failing line, when Playwright captured one. */
  snippet: string | null;
  /** One entry per attempt, oldest first — lets a retry pattern be spotted. */
  attempts: { status: string; durationMs: number }[];
}

/** Who needs to act on a failure. Only backend/frontend produce a dev-facing message. */
export type FailureOwner = "backend" | "frontend" | "test" | "infra";

/**
 * Identifies which rendered test row an analysis belongs to. Lives here rather
 * than in lib/failureAnalysis.ts so the browser can call it without pulling the
 * Supabase admin client into the bundle.
 */
export function testKey(test: Pick<TestCaseResult, "file" | "line" | "titlePath">): string {
  return `${test.file}:${test.line}:${test.titlePath.join(" › ")}`;
}

export interface FailureAnalysis {
  /** Stable hash of (file:line + normalized error) — the cache key. */
  fingerprint: string;
  /** Identifies which rendered test row this belongs to. */
  key: string;
  owner: FailureOwner;
  confidence: "high" | "medium" | "low";
  /** Plain-language cause, per locale. */
  cause: Record<Locale, string>;
  /**
   * Uzbek text to send on. Its audience depends on `owner`: the dev team for
   * backend/frontend, the QA engineer for "test", and null for "infra" (where
   * there is nobody to message — it just needs a retry).
   */
  messageUz: string | null;
}

export interface RunAnalysisResponse {
  /** False when ANTHROPIC_API_KEY is absent — the UI then renders as before. */
  configured: boolean;
  analyses: FailureAnalysis[];
  /** Set when the per-run cap kicked in. */
  limited?: { analyzed: number; total: number };
  error?: string;
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

export type UserRole = "admin" | "editor" | "viewer";

/**
 * Never includes the password hash — safe to send to the client.
 *
 * `allowedWorkflows` is ignored for admins (they always have unrestricted
 * access, enforced in app code). For editor/viewer, an empty array means no
 * projects assigned yet — treated as "no access", not "all access".
 */
export interface UserRecord {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  allowedWorkflows: number[];
}

export interface UsersResponse {
  ok: boolean;
  users: UserRecord[];
  error?: string;
}

export interface UserResponse {
  ok: boolean;
  user?: UserRecord;
  error?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  name?: string;
  role: UserRole;
  /** Ignored server-side when role is "admin". Defaults to []. */
  allowedWorkflows?: number[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  /** Omit to leave the password unchanged. */
  password?: string;
  /** Omit to leave the current assignment unchanged. Ignored when role is "admin". */
  allowedWorkflows?: number[];
}

export interface OnlineUser {
  id: number;
  username: string;
  name: string | null;
}

export interface OnlineUsersResponse {
  ok: boolean;
  users: OnlineUser[];
  error?: string;
}

export interface DailyVisits {
  /** YYYY-MM-DD, local calendar day. */
  date: string;
  count: number;
  /** Usernames who logged in that day, deduped — powers the chart tooltip. */
  users: string[];
}

export interface VisitsResponse {
  ok: boolean;
  days: DailyVisits[];
  error?: string;
}
