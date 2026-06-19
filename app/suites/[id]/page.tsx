"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
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

function TestRow({
  test,
  onRun,
}: {
  test: TestCaseResult;
  onRun: (filter: string) => Promise<TriggerResponse>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "pending" | "triggered">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (state === "pending") return;
    setState("pending");
    setError(null);
    const result = await onRun(testFilter(test));
    if (result.ok) {
      setState("triggered");
      // Let the user fire it again after a short confirmation window.
      setTimeout(() => setState("idle"), 4000);
    } else {
      setState("idle");
      setError(result.error ?? "Failed to trigger run");
    }
  };

  const title = test.titlePath.join(" › ");

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-panel px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-gray-500">
          {testFilter(test)}
          {test.project ? ` · ${test.project}` : ""}
        </p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <button
        onClick={handleRun}
        disabled={state === "pending"}
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed",
          state === "triggered"
            ? "bg-emerald-600"
            : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70",
        ].join(" ")}
      >
        {state === "pending" && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {state === "triggered" ? t("suiteTests.triggered") : t("suiteTests.run")}
      </button>
    </div>
  );
}

export default function SuiteTestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const workflowId = Number(id);

  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const { data: runsData } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher);

  const workflow = workflowsData?.workflows.find((w) => w.id === workflowId);

  // Newest run for this workflow that actually produced a report artifact.
  // Only success/failure runs upload one (via `if: always()`); cancelled or
  // skipped runs have no results.json, so we skip them when sourcing the list.
  const latestRunId = useMemo(() => {
    const runs = runsData?.runs ?? [];
    return runs.find(
      (r) =>
        r.workflowId === workflowId &&
        r.status === "completed" &&
        (r.conclusion === "success" || r.conclusion === "failure")
    )?.id;
  }, [runsData, workflowId]);

  const { data: testsData, isLoading } = useSWR<TestReportResponse>(
    latestRunId ? `/api/runs/${latestRunId}/tests` : null,
    fetcher
  );

  const handleRun = async (filter: string): Promise<TriggerResponse> => {
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, inputs: { test_filter: filter } }),
    });
    return res.json();
  };

  const tests = testsData?.tests ?? [];

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

      {isLoading && latestRunId ? (
        <p className="text-sm text-gray-500">{t("suiteTests.loading")}</p>
      ) : tests.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
          {t("suiteTests.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => (
            <TestRow
              key={`${testFilter(test)}::${test.project}`}
              test={test}
              onRun={handleRun}
            />
          ))}
        </div>
      )}
    </div>
  );
}
