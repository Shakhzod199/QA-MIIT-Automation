"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { useCurrentUser } from "@/components/UserProvider";
import { TestInfoModal } from "@/components/TestInfoModal";
import { InfoIcon } from "@/components/icons";
import { getSuiteDisabledReason } from "@/lib/disabledSuites";
import { hasRole } from "@/lib/permissions";
import { getTestDescription } from "@/lib/testDescriptions";
import { runsRefreshInterval } from "@/lib/runsPolling";
import type { RunSummary, RunsResponse, TestCaseResult, TestReportResponse, TriggerResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TEST_STATUS_STYLES: Record<string, React.CSSProperties> = {
  passed: { background: "rgba(61,220,151,0.14)", color: "#3ddc97" },
  failed: { background: "rgba(255,93,93,0.14)", color: "#ff5d5d" },
  timedOut: { background: "rgba(255,93,93,0.14)", color: "#ff5d5d" },
  flaky: { background: "rgba(245,181,68,0.14)", color: "#f5b544" },
  skipped: { background: "rgba(255,255,255,0.06)", color: "#8a93a0" },
};
const TEST_STATUS_LABELS: Record<string, string> = {
  passed: "passed",
  failed: "failed",
  timedOut: "timeout",
  flaky: "flaky",
  skipped: "skipped",
};

/** Playwright filter for a single test, e.g. "tests/pmi-tests/login.spec.ts:5". */
function testFilter(test: TestCaseResult): string {
  return test.line ? `${test.file}:${test.line}` : test.file;
}

// Circular, radio-styled checkbox (keeps native multi-select checkbox
// semantics — selecting several tests still works — just looks like a radio).
const RADIO_CHECKBOX_CLASS =
  "h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-[4px] border border-[rgba(255,255,255,0.2)] bg-transparent transition-colors checked:border-q-green checked:bg-q-green";

/**
 * The Playwright test-case list + run controls for one suite, for run types
 * that have a real per-test catalog (frontend, security — API/Load have a
 * different, run-level-only model and stay on the suite detail page's simple
 * stat-card view instead). Shared by app/suites/[id]/page.tsx (any of those
 * types, via `runType`) and the "All test cases" home page (frontend only,
 * the default) so both stay in sync with one implementation.
 */
export function SuiteTestCaseList({
  workflowId,
  workflowName,
  runType = "frontend",
}: {
  workflowId: number;
  workflowName?: string;
  runType?: RunSummary["runType"];
}) {
  const { t, locale } = useI18n();
  const [infoTest, setInfoTest] = useState<TestCaseResult | null>(null);

  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher, {
    refreshInterval: runsRefreshInterval,
  });

  const currentUser = useCurrentUser();
  const canTrigger = !currentUser || hasRole(currentUser.role, "editor");
  const disabledReason = getSuiteDisabledReason(workflowName) ?? (canTrigger ? null : t("suite.viewerReadOnly"));

  // Newest *full-suite* run of this type for this workflow that produced a
  // report artifact (success/failure only, never a single-test run — that
  // can't be the source of the full catalog). Same rule as the suite page.
  const latestRunId = useMemo(() => {
    const runs = runsData?.runs ?? [];
    return runs.find(
      (r) =>
        r.workflowId === workflowId &&
        r.runType === runType &&
        r.status === "completed" &&
        (r.conclusion === "success" || r.conclusion === "failure") &&
        !r.testFilter
    )?.id;
  }, [runsData, workflowId, runType]);

  const { data: testsData, isLoading } = useSWR<TestReportResponse>(
    latestRunId ? `/api/runs/${latestRunId}/tests` : null,
    fetcher,
    // See app/suites/[id]/page.tsx's identical override for why: without
    // this, switching to a workflow+runType with no completed run yet (key
    // goes to null) keeps showing whatever unrelated run's test list was
    // last fetched, instead of the empty state.
    { keepPreviousData: false }
  );

  const tests = testsData?.tests ?? [];

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
    setSelected((prev) => (prev.size === allFilters.length ? new Set() : new Set(allFilters)));

  // Run the checked tests. Every test checked → run the whole suite (no filter);
  // otherwise pass the selected filters space-joined.
  const handleRunSelected = async () => {
    if (state === "pending" || selected.size === 0 || disabledReason) return;
    setState("pending");
    setError(null);

    const filter = allSelected ? "" : Array.from(selected).join(" ");
    // The workflow's `type` input defaults to "frontend", so frontend runs can
    // omit it; every other type must say so explicitly or the dispatch would
    // silently run the frontend suite instead.
    const typeInput = runType !== "frontend" ? { type: runType } : {};
    const inputs = filter ? { ...typeInput, test_filter: filter } : typeInput;
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.keys(inputs).length > 0 ? { workflowId, inputs } : { workflowId }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setState("triggered");
      setTimeout(() => mutateRuns(), 1500);
      setTimeout(() => setState("idle"), 4000);
    } else {
      setState("idle");
      setError(result.error ?? "Failed to trigger run");
    }
  };

  // Run the whole suite with no filter — the empty state's only action, since
  // without a completed run there's no per-test catalog to pick from yet (the
  // first full run is what produces the report the list is built from).
  const handleRunAll = async () => {
    if (state === "pending" || disabledReason) return;
    setState("pending");
    setError(null);
    const typeInput = runType !== "frontend" ? { type: runType } : {};
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.keys(typeInput).length > 0 ? { workflowId, inputs: typeInput } : { workflowId }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setState("triggered");
      setTimeout(() => mutateRuns(), 1500);
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
    const typeInput = runType !== "frontend" ? { type: runType } : {};
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, inputs: { ...typeInput, test_filter: filter } }),
    });
    const result: TriggerResponse = await res.json();
    setPendingFilter(null);
    if (result.ok) {
      setTriggeredFilter(filter);
      setTimeout(() => mutateRuns(), 1500);
      setTimeout(() => setTriggeredFilter(null), 3000);
    } else {
      setError(result.error ?? "Failed to trigger run");
    }
  };

  if (isLoading && latestRunId) {
    return <p className="text-[13px] text-q-muted">{t("suiteTests.loading")}</p>;
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
        <p>{t("suiteTests.empty")}</p>
        <button
          onClick={handleRunAll}
          disabled={state === "pending" || !!disabledReason}
          title={disabledReason ?? undefined}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
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
        {error && <p className="mt-2 text-[12px] text-q-red">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel">
        {/* Toolbar: select all + run selected */}
        <div
          className="flex items-center justify-between gap-4 border-b border-surface-border px-[18px] py-[11px]"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className={RADIO_CHECKBOX_CLASS} checked={allSelected} onChange={toggleAll} />
            <span className="text-[13px] font-semibold text-q-text">{t("runModal.allTests")}</span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums text-q-dim"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              {tests.length}
            </span>
            {selected.size > 0 && (
              <span className="font-mono text-[11px] text-q-green">
                {selected.size} {t("suiteTests.selected")}
              </span>
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

        {disabledReason && (
          <p className="border-b border-surface-border px-[18px] py-2 text-[12px] text-q-amber">{disabledReason}</p>
        )}
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInfoTest(test);
                      }}
                      className="shrink-0 rounded-full p-0.5 text-q-dim transition hover:text-q-green"
                    >
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {test.project && (
                    <span
                      className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-medium text-q-green"
                      style={{ background: "rgba(61,220,151,0.1)" }}
                    >
                      {test.project}
                    </span>
                  )}
                </div>
                {describePath && <div className="mt-[2px] font-mono text-[11px] text-q-dim">{describePath}</div>}
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
                        isThisPending || isThisTriggered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={
                        isThisTriggered
                          ? { background: "rgba(61,220,151,0.15)", color: "#3ddc97", borderColor: "rgba(61,220,151,0.4)" }
                          : { background: "transparent", color: "#3ddc97", borderColor: "rgba(61,220,151,0.4)" }
                      }
                      disabled={isAnyPending || !!disabledReason}
                      onClick={(e) => {
                        e.preventDefault();
                        handleRunSingleTest(filter);
                      }}
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

      {infoTest && (
        <TestInfoModal
          title={infoTest.titlePath.join(" › ")}
          description={getTestDescription(infoTest.file, infoTest.line, locale) ?? ""}
          onClose={() => setInfoTest(null)}
        />
      )}
    </>
  );
}
