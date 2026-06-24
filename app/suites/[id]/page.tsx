"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { StatsCards } from "@/components/StatsCards";
import { SuiteCard } from "@/components/SuiteCard";
import { RunsTable } from "@/components/RunsTable";
import { FlaskIcon } from "@/components/icons";
import { computeStats } from "@/lib/stats";
import type {
  RunsResponse,
  TestCaseResult,
  TestReportResponse,
  TriggerResponse,
  WorkflowsResponse,
} from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** Playwright filter for a single test, e.g. "tests/pmi-tests/login.spec.ts:5". */
function testFilter(test: TestCaseResult): string {
  return test.line ? `${test.file}:${test.line}` : test.file;
}

// Circular, radio-styled checkbox (keeps native multi-select checkbox
// semantics — selecting several tests still works — just looks like a radio).
const RADIO_CHECKBOX_CLASS =
  "h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-gray-500 bg-transparent transition-colors checked:border-emerald-500 checked:bg-[radial-gradient(circle,#10b981_40%,transparent_41%)]";

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
  const { t } = useI18n();
  const workflowId = Number(id);
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") as "frontend" | "api" | "load" | null) ?? "frontend";

  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher);

  const workflow = workflowsData?.workflows.find((w) => w.id === workflowId);

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
        r.status === "completed" &&
        (r.conclusion === "success" || r.conclusion === "failure") &&
        !r.testFilter
    )?.id;
  }, [runsData, workflowId]);

  const { data: testsData, isLoading } = useSWR<TestReportResponse>(
    latestRunId ? `/api/runs/${latestRunId}/tests` : null,
    fetcher
  );

  const tests = testsData?.tests ?? [];

  // Grouped by spec file (preserving first-seen order) so the file path is
  // shown once per group instead of repeated on every single row.
  const testsByFile = useMemo(() => {
    const groups = new Map<string, TestCaseResult[]>();
    for (const test of tests) {
      if (!groups.has(test.file)) groups.set(test.file, []);
      groups.get(test.file)!.push(test);
    }
    return groups;
  }, [tests]);

  // ── Selection (checkboxes) ──────────────────────────────────────────────
  // Distinct filters (two tests can share a file:line across projects).
  const allFilters = useMemo(() => Array.from(new Set(tests.map(testFilter))), [tests]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"idle" | "pending" | "triggered">("idle");
  const [error, setError] = useState<string | null>(null);

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
    if (state === "pending" || selected.size === 0) return;
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

  // ── Backend (api/load) ──────────────────────────────────────────────────
  // No per-test selection: api/load runs are dispatched as a single unit via
  // the workflow's "type" input, so this is a one-button trigger instead of
  // the frontend checkbox list above.
  const [typeRunState, setTypeRunState] = useState<"idle" | "pending" | "triggered">("idle");
  const [typeRunError, setTypeRunError] = useState<string | null>(null);

  const handleRunType = async () => {
    if (typeRunState === "pending") return;
    setTypeRunState("pending");
    setTypeRunError(null);

    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, inputs: { type } }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setTypeRunState("triggered");
      setTimeout(() => setTypeRunState("idle"), 4000);
    } else {
      setTypeRunState("idle");
      setTypeRunError(result.error ?? "Failed to trigger run");
    }
  };

  if (type !== "frontend") {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
            ← {t("suiteTests.back")}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {workflow?.name ?? `Suite #${workflowId}`} · {t(TYPE_LABEL_KEY[type])}
          </h2>
        </div>

        <StatsCards stats={scopedStats} />

        {workflow && (
          <SuiteCard workflow={workflow} showRunButton={false} showRunSeparately={false} />
        )}

        <div>
          <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
          <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={handleCancel} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-panel px-4 py-3">
          <span className="text-sm font-medium text-white">{t(TYPE_LABEL_KEY[type])}</span>
          <button
            onClick={handleRunType}
            disabled={typeRunState === "pending"}
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              typeRunState === "triggered" ? "bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-500",
            ].join(" ")}
          >
            {typeRunState === "pending" && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {typeRunState === "triggered" ? t("suiteTests.triggered") : t("suiteTests.run")}
          </button>
        </div>

        {typeRunError && <p className="text-xs text-red-400">{typeRunError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← {t("suiteTests.back")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {workflow?.name ?? `Suite #${workflowId}`}
        </h2>
        <p className="text-sm text-gray-500">{t("suiteTests.subtitle")}</p>
      </div>

      <StatsCards stats={scopedStats} />

      {workflow && (
        <SuiteCard workflow={workflow} showRunButton={false} showRunSeparately={false} />
      )}

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
        <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={handleCancel} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("suiteTests.testCases")}</h3>

        {isLoading && latestRunId ? (
          <p className="text-sm text-gray-500">{t("suiteTests.loading")}</p>
        ) : tests.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            {t("suiteTests.empty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
            {/* Toolbar: select all + run selected — styled like a table header */}
            <div className="flex items-center justify-between gap-4 border-b border-surface-border bg-surface-hover/40 px-4 py-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className={RADIO_CHECKBOX_CLASS}
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-sm font-medium text-white">{t("runModal.allTests")}</span>
                <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs tabular-nums text-gray-400">
                  {tests.length}
                </span>
                {selected.size > 0 && (
                  <span className="text-xs text-indigo-300">{selected.size} {t("suiteTests.selected")}</span>
                )}
              </label>
              <button
                onClick={handleRunSelected}
                disabled={state === "pending" || selected.size === 0}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                  state === "triggered"
                    ? "bg-emerald-600"
                    : "bg-indigo-600 hover:bg-indigo-500",
                ].join(" ")}
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
              <p className="border-b border-surface-border px-4 py-2 text-xs text-red-400">{error}</p>
            )}

            {/* Test rows, grouped by spec file so the path appears once per group. */}
            {Array.from(testsByFile.entries()).map(([file, fileTests]) => (
              <div key={file}>
                <div className="flex items-center gap-2 border-b border-surface-border bg-surface-hover/20 px-4 py-1.5">
                  <FlaskIcon className="h-3 w-3 shrink-0 text-gray-500" />
                  <span className="truncate font-mono text-xs text-gray-500">{file}</span>
                </div>
                {fileTests.map((test) => {
                  const filter = testFilter(test);
                  return (
                    <label
                      key={`${filter}::${test.project}`}
                      className="flex cursor-pointer items-center gap-3 border-b border-surface-border px-4 py-2.5 transition last:border-0 hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        className={RADIO_CHECKBOX_CLASS}
                        checked={selected.has(filter)}
                        onChange={() => toggleOne(filter)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                        {test.titlePath.join(" › ")}
                      </span>
                      {test.project && (
                        <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                          {test.project}
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-xs text-gray-500">
                        :{test.line}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
