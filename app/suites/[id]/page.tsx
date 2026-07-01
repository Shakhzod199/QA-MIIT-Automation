"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { useCurrentUser } from "@/components/UserProvider";
import { StatCard, StatsCards } from "@/components/StatsCards";
import { RunsTable } from "@/components/RunsTable";
import { TypeTabs } from "@/components/TypeTabs";
import { TestInfoModal } from "@/components/TestInfoModal";
import { InfoIcon } from "@/components/icons";
import { computeStats } from "@/lib/stats";
import { getSuiteDisabledReason } from "@/lib/disabledSuites";
import { hasRole } from "@/lib/permissions";
import { getTestDescription } from "@/lib/testDescriptions";
import { formatDuration, getStatusBadge } from "@/lib/format";
import type {
  RunsResponse,
  TestCaseResult,
  TestReportResponse,
  TriggerResponse,
  WorkflowsResponse,
} from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TEST_STATUS_STYLES: Record<string, React.CSSProperties> = {
  passed:   { background: "rgba(61,220,151,0.14)",  color: "#3ddc97" },
  failed:   { background: "rgba(255,93,93,0.14)",   color: "#ff5d5d" },
  timedOut: { background: "rgba(255,93,93,0.14)",   color: "#ff5d5d" },
  flaky:    { background: "rgba(245,181,68,0.14)",  color: "#f5b544" },
  skipped:  { background: "rgba(255,255,255,0.06)", color: "#8a93a0" },
};
const TEST_STATUS_LABELS: Record<string, string> = {
  passed:   "passed",
  failed:   "failed",
  timedOut: "timeout",
  flaky:    "flaky",
  skipped:  "skipped",
};

/** Playwright filter for a single test, e.g. "tests/pmi-tests/login.spec.ts:5". */
function testFilter(test: TestCaseResult): string {
  return test.line ? `${test.file}:${test.line}` : test.file;
}

// Circular, radio-styled checkbox (keeps native multi-select checkbox
// semantics — selecting several tests still works — just looks like a radio).
const RADIO_CHECKBOX_CLASS =
  "h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-[4px] border border-[rgba(255,255,255,0.2)] bg-transparent transition-colors checked:border-q-green checked:bg-q-green";

export default function SuiteTestsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <SuiteTestsPageInner params={params} />
    </Suspense>
  );
}

const TYPE_LABEL_KEY = { frontend: "suite.frontend", api: "suite.api", load: "suite.load" } as const;

function SuiteTestsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const [infoTest, setInfoTest] = useState<TestCaseResult | null>(null);
  const workflowId = Number(id);
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") as "frontend" | "api" | "load" | null) ?? "frontend";

  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher);

  const workflow = workflowsData?.workflows.find((w) => w.id === workflowId);
  const currentUser = useCurrentUser();
  const canTrigger = !currentUser || hasRole(currentUser.role, "editor");
  const disabledReason = getSuiteDisabledReason(workflow?.name) ?? (canTrigger ? null : t("suite.viewerReadOnly"));

  // This page's runs, stats, and card are scoped to just this workflow + type
  // (unlike the home dashboard, which mixes every project/type together).
  const scopedRuns = useMemo(
    () => (runsData?.runs ?? []).filter((r) => r.workflowId === workflowId && r.runType === type),
    [runsData, workflowId, type]
  );
  const scopedStats = useMemo(() => computeStats(scopedRuns), [scopedRuns]);

  const handleCancel = async (runId: number): Promise<TriggerResponse> => {
    const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
    const result: TriggerResponse = await res.json();
    if (result.ok) {
      setTimeout(() => mutateRuns(), 1500);
    }
    return result;
  };

  // Newest *full-suite* run for this workflow that produced a report artifact.
  // - success/failure only: those upload a report (via `if: always()`);
  //   cancelled/skipped runs have no results.json.
  // - !testFilter: single-test runs only contain the one test they ran, so they
  //   can't be the source of the full catalog — skip them here.
  const latestRunId = useMemo(() => {
    const runs = runsData?.runs ?? [];
    return runs.find(
      (r) =>
        r.workflowId === workflowId &&
        r.runType === type &&
        r.status === "completed" &&
        (r.conclusion === "success" || r.conclusion === "failure") &&
        !r.testFilter
    )?.id;
  }, [runsData, workflowId, type]);

  const { data: testsData, isLoading } = useSWR<TestReportResponse>(
    latestRunId ? `/api/runs/${latestRunId}/tests` : null,
    fetcher
  );

  const tests = testsData?.tests ?? [];


  // ── Selection (checkboxes) ──────────────────────────────────────────────
  // Distinct filters (two tests can share a file:line across projects).
  const allFilters = useMemo(() => Array.from(new Set(tests.map(testFilter))), [tests]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"idle" | "pending" | "triggered">("idle");
  const [error, setError] = useState<string | null>(null);
  // Tracks which individual "Run test" row button is in-flight / just-triggered.
  const [pendingFilter, setPendingFilter] = useState<string | null>(null);
  const [triggeredFilter, setTriggeredFilter] = useState<string | null>(null);

  const allSelected = allFilters.length > 0 && selected.size === allFilters.length;

  const toggleOne = (filter: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === allFilters.length ? new Set() : new Set(allFilters)
    );

  // Run the checked tests. Every test checked → run the whole suite (no filter);
  // otherwise pass the selected filters space-joined.
  const handleRunSelected = async () => {
    if (state === "pending" || selected.size === 0 || disabledReason) return;
    setState("pending");
    setError(null);

    const filter = allSelected ? "" : Array.from(selected).join(" ");
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        filter ? { workflowId, inputs: { test_filter: filter } } : { workflowId }
      ),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setState("triggered");
      setTimeout(() => setState("idle"), 4000);
    } else {
      setState("idle");
      setError(result.error ?? "Failed to trigger run");
    }
  };

  const handleRunSingleTest = async (filter: string) => {
    if (pendingFilter || disabledReason) return;
    setPendingFilter(filter);
    setError(null);
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, inputs: { test_filter: filter } }),
    });
    const result: TriggerResponse = await res.json();
    setPendingFilter(null);
    if (result.ok) {
      setTriggeredFilter(filter);
      setTimeout(() => setTriggeredFilter(null), 3000);
    } else {
      setError(result.error ?? "Failed to trigger run");
    }
  };

  // ── Backend (api/load) ──────────────────────────────────────────────────
  // No per-test selection: api runs are dispatched as a single unit via the
  // workflow's "type" input. load (K6) additionally offers a per-kind
  // button (Load/Stress/...) by passing that kind as `test_filter` — the
  // same input frontend/api use for a single-test filter, repurposed here
  // (workflow-side) as "which k6 script to run". Empty = run every kind,
  // same "no filter = whole suite" convention test_filter has elsewhere.
  const [typeRunState, setTypeRunState] = useState<"idle" | "pending" | "triggered">("idle");
  const [typeRunError, setTypeRunError] = useState<string | null>(null);
  // Which k6 kind ("", "load", "stress", ...) is mid-flight, so only that
  // button shows a spinner while the others stay clickable... except we
  // disable all of them together below to avoid piling up concurrent runs
  // against the same live API.
  const [pendingKind, setPendingKind] = useState<string | null>(null);

  const handleRunType = async (kind = "") => {
    if (typeRunState === "pending" || disabledReason) return;
    setTypeRunState("pending");
    setPendingKind(kind);
    setTypeRunError(null);

    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        inputs: kind ? { type, test_filter: kind } : { type },
      }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setTypeRunState("triggered");
      setTimeout(() => {
        setTypeRunState("idle");
        setPendingKind(null);
      }, 4000);
    } else {
      setTypeRunState("idle");
      setPendingKind(null);
      setTypeRunError(result.error ?? "Failed to trigger run");
    }
  };

  // Extend this list when spike/smoke scripts exist — each entry is just a
  // test_filter value plus a label, nothing else needs to change.
  const K6_KINDS = [
    { value: "", label: t("suiteTests.runAll") },
    { value: "load", label: t("suiteTests.runLoad") },
    { value: "stress", label: t("suiteTests.runStress") },
  ];

  if (type !== "frontend") {
    // API tests have a real per-test catalog (the report's test list), so
    // show counts of how many API tests exist/passed/failed instead of the
    // run-level stats below. K6 (load) has no such catalog — it only ever
    // produces threshold pass/fail, already shown per-run in the table — so
    // it keeps the original run-based cards.
    const apiSummary = testsData?.summary;

    // K6 has no per-test catalog (just thresholds), so its cards stay
    // run-level — but reframed around what actually matters for a load
    // test: how long it takes and what happened most recently, rather than
    // a generic "Last Run" timestamp.
    const latestRun = scopedRuns[0];
    const completedDurations = scopedRuns
      .filter((r) => r.status === "completed" && r.durationSec != null)
      .map((r) => r.durationSec as number);
    const avgDurationSec =
      completedDurations.length > 0
        ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
        : null;
    const latestBadge = latestRun ? getStatusBadge(latestRun.status, latestRun.conclusion) : null;

    return (
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] text-q-dim">
            <Link href="/" className="hover:text-q-sub transition">Test Cases</Link>
            {" / "}{workflow?.name ?? `Suite #${workflowId}`}
          </p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[21px] font-semibold tracking-[-0.5px] text-q-text">
                {workflow?.name ?? `Suite #${workflowId}`}
              </h2>
              {workflow?.state === "active" && (
                <span className="flex items-center gap-1.5 rounded-[20px] px-[10px] py-1 text-[11px] font-semibold" style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-q-green" />
                  workflow active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {workflow && (
                <a href={workflow.htmlUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-q-muted hover:text-q-sub transition">
                  View on GitHub ↗
                </a>
              )}
            </div>
          </div>
        </div>

        <TypeTabs workflowId={workflowId} active={type} />

        {type === "api" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t("suiteTests.totalApis")} value={String(apiSummary?.total ?? 0)} />
            <StatCard
              label={t("suiteTests.apisPassed")}
              value={String(apiSummary?.passed ?? 0)}
              sub={apiSummary?.total ? `${Math.round((apiSummary.passed / apiSummary.total) * 100)}%` : undefined}
            />
            <StatCard
              label={t("suiteTests.apisFailed")}
              value={String(apiSummary?.failed ?? 0)}
              sub={apiSummary?.total ? `${Math.round((apiSummary.failed / apiSummary.total) * 100)}%` : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("suiteTests.totalRuns")} value={String(scopedStats.total)} />
            <StatCard
              label={t("suiteTests.thresholdPassRate")}
              value={`${scopedStats.passRate}%`}
              sub={t("suiteTests.thresholdPassRateSub")}
            />
            <StatCard
              label={t("suiteTests.avgDuration")}
              value={avgDurationSec != null ? formatDuration(avgDurationSec) : "—"}
            />
            {latestRun && latestBadge ? (
              <Link href={`/reports/${latestRun.id}`} className="block">
                <StatCard
                  label={t("suiteTests.latestResult")}
                  value={latestBadge.label}
                  sub={t("table.viewK6Report")}
                  interactive
                />
              </Link>
            ) : (
              <StatCard label={t("suiteTests.latestResult")} value="—" />
            )}
          </div>
        )}

        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              {workflow && workflow.state !== "active" && (
                <p className="text-[12px] text-q-amber">workflow is {workflow.state}</p>
              )}
              {disabledReason && <p className="text-[12px] text-q-amber">{disabledReason}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(type === "load" ? K6_KINDS : [{ value: "", label: t("suiteTests.run") }]).map((kind) => {
                const isThisPending = typeRunState === "pending" && pendingKind === kind.value;
                const isThisTriggered = typeRunState === "triggered" && pendingKind === kind.value;
                return (
                  <button
                    key={kind.value}
                    onClick={() => handleRunType(kind.value)}
                    disabled={typeRunState === "pending" || !!disabledReason}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      isThisTriggered
                        ? { background: "rgba(61,220,151,0.2)", color: "#3ddc97" }
                        : { background: "#3ddc97", color: "#06140d" }
                    }
                  >
                    {isThisPending && (
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {isThisTriggered ? t("suiteTests.triggered") : kind.label}
                  </button>
                );
              })}
            </div>
          </div>
          {typeRunError && <p className="mt-2 text-[12px] text-q-red">{typeRunError}</p>}
        </div>

        <div>
          <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
          <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={canTrigger ? handleCancel : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] text-q-dim">
          <Link href="/" className="hover:text-q-sub transition">Test Cases</Link>
          {" / "}{workflow?.name ?? `Suite #${workflowId}`}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[21px] font-semibold tracking-[-0.5px] text-q-text">
              {workflow?.name ?? `Suite #${workflowId}`}
            </h2>
            {workflow?.state === "active" && (
              <span className="flex items-center gap-1.5 rounded-[20px] px-[10px] py-1 text-[11px] font-semibold" style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-q-green" />
                workflow active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {workflow && (
              <a href={workflow.htmlUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-q-muted hover:text-q-sub transition">
                View on GitHub ↗
              </a>
            )}
            {disabledReason && (
              <p className="text-[12px] text-q-amber">{disabledReason}</p>
            )}
          </div>
        </div>
      </div>

      <TypeTabs workflowId={workflowId} active={type} />

      {testsData?.available ? (
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total tests" value={String(testsData.summary.total)} />
          <StatCard label="Passed" value={String(testsData.summary.passed)} valueColor="#3ddc97" />
          <StatCard label="Failed" value={String(testsData.summary.failed)} valueColor={testsData.summary.failed > 0 ? "#ff5d5d" : undefined} />
          <StatCard label="Flaky" value={String(testsData.summary.flaky)} valueColor={testsData.summary.flaky > 0 ? "#f5b544" : undefined} />
        </div>
      ) : (
        <StatsCards stats={scopedStats} />
      )}

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
        <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={canTrigger ? handleCancel : undefined} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("suiteTests.testCases")}</h3>

        {isLoading && latestRunId ? (
          <p className="text-[13px] text-q-muted">{t("suiteTests.loading")}</p>
        ) : tests.length === 0 ? (
          <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
            {t("suiteTests.empty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel">
            {/* Toolbar: select all + run selected */}
            <div className="flex items-center justify-between gap-4 border-b border-surface-border px-[18px] py-[11px]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className={RADIO_CHECKBOX_CLASS}
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-[13px] font-semibold text-q-text">{t("runModal.allTests")}</span>
                <span className="rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums text-q-dim" style={{ background: "rgba(255,255,255,0.06)" }}>
                  {tests.length}
                </span>
                {selected.size > 0 && (
                  <span className="font-mono text-[11px] text-q-green">{selected.size} {t("suiteTests.selected")}</span>
                )}
              </label>
              <button
                onClick={handleRunSelected}
                disabled={state === "pending" || selected.size === 0 || !!disabledReason}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] px-4 py-[7px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={
                  state === "triggered"
                    ? { background: "rgba(61,220,151,0.2)", color: "#3ddc97" }
                    : { background: "#3ddc97", color: "#06140d" }
                }
              >
                {state === "pending" && (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {state === "triggered" ? t("suiteTests.triggered") : t("suiteTests.run")}
              </button>
            </div>

            {error && (
              <p className="border-b border-surface-border px-[18px] py-2 font-mono text-[12px] text-q-red">{error}</p>
            )}

            {/* Table header */}
            <div className="flex items-center gap-3 border-b border-surface-border px-[18px] py-[11px] font-mono text-[10px] font-semibold uppercase tracking-[0.6px] text-q-dim">
              <span className="w-4 flex-none" />
              <span className="flex-1">Test</span>
              <span className="w-[84px]">Status</span>
              <span className="w-[64px]">Duration</span>
              <span className="w-[56px]">Retries</span>
              <span className="w-[104px]" />
            </div>

            {/* Test rows — flat list with status/duration/retries columns */}
            {tests.map((test) => {
              const filter = testFilter(test);
              const testTitle = test.titlePath[test.titlePath.length - 1] ?? test.titlePath.join(" › ");
              const describePath = test.titlePath.length > 1 ? test.titlePath.slice(0, -1).join(" › ") : "";
              const durationLabel = test.durationMs > 0 ? `${(test.durationMs / 1000).toFixed(1)}s` : "—";
              const description = getTestDescription(test.file, test.line, locale);
              const isFailed = test.status === "failed" || test.status === "timedOut";
              return (
                <label
                  key={`${filter}::${test.project}`}
                  className="group flex cursor-pointer items-start gap-3 border-b border-surface-border/60 px-[18px] py-[13px] transition last:border-0 hover:bg-surface-hover"
                >
                  <span className="w-4 flex-none pt-[2px]">
                    <input
                      type="checkbox"
                      className={RADIO_CHECKBOX_CLASS}
                      checked={selected.has(filter)}
                      onChange={() => toggleOne(filter)}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-q-text">{testTitle}</span>
                      {description && (
                        <button
                          type="button"
                          title={t("testInfo.tooltip")}
                          aria-label={t("testInfo.tooltip")}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInfoTest(test); }}
                          className="shrink-0 rounded-full p-0.5 text-q-dim transition hover:text-q-green"
                        >
                          <InfoIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {test.project && (
                        <span className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-medium text-q-green" style={{ background: "rgba(61,220,151,0.1)" }}>
                          {test.project}
                        </span>
                      )}
                    </div>
                    {describePath && (
                      <div className="mt-[2px] font-mono text-[11px] text-q-dim">{describePath}</div>
                    )}
                    {isFailed && test.error && (
                      <div
                        className="mt-[7px] truncate font-mono text-[11px] text-[#ff7a7a]"
                        style={{ background: "rgba(255,93,93,0.08)", borderLeft: "2px solid #ff5d5d", padding: "6px 9px", borderRadius: "0 5px 5px 0" }}
                      >
                        {test.error}
                      </div>
                    )}
                  </div>
                  <span className="w-[84px] flex-none pt-[2px]">
                    <span
                      className="rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
                      style={TEST_STATUS_STYLES[test.status] ?? TEST_STATUS_STYLES.skipped}
                    >
                      {TEST_STATUS_LABELS[test.status] ?? test.status}
                    </span>
                  </span>
                  <span className="w-[64px] flex-none pt-[2px] font-mono text-[12px] text-q-sub">{durationLabel}</span>
                  <span
                    className="w-[56px] flex-none pt-[2px] font-mono text-[12px]"
                    style={{ color: test.retries > 0 ? "#f5b544" : "#5b636e" }}
                  >
                    {test.retries}
                  </span>
                  <span className="flex w-[104px] flex-none justify-end">
                    {(() => {
                      const isThisPending = pendingFilter === filter;
                      const isThisTriggered = triggeredFilter === filter;
                      const isAnyPending = !!pendingFilter;
                      return (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 rounded-[7px] border px-[10px] py-[5px] font-semibold text-[11px] transition disabled:cursor-not-allowed ${
                            isThisPending || isThisTriggered
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                          style={
                            isThisTriggered
                              ? { background: "rgba(61,220,151,0.15)", color: "#3ddc97", borderColor: "rgba(61,220,151,0.4)" }
                              : { background: "transparent", color: "#3ddc97", borderColor: "rgba(61,220,151,0.4)" }
                          }
                          disabled={isAnyPending || !!disabledReason}
                          onClick={(e) => { e.preventDefault(); handleRunSingleTest(filter); }}
                        >
                          {isThisPending ? (
                            <>
                              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Running…
                            </>
                          ) : isThisTriggered ? (
                            "✓ Queued"
                          ) : (
                            "▶ Run test"
                          )}
                        </button>
                      );
                    })()}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {infoTest && (
        <TestInfoModal
          title={infoTest.titlePath.join(" › ")}
          description={getTestDescription(infoTest.file, infoTest.line, locale) ?? ""}
          onClose={() => setInfoTest(null)}
        />
      )}
    </div>
  );
}
