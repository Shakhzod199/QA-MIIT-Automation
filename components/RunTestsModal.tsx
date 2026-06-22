"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import type {
  RunsResponse,
  TestCaseResult,
  TestReportResponse,
} from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** Playwright filter for a single test, e.g. "tests/pmi-tests/login.spec.ts:5". */
function testFilter(test: TestCaseResult): string {
  return test.line ? `${test.file}:${test.line}` : test.file;
}

/**
 * Modal launched from a suite's "Run" button. Instead of dispatching the whole
 * suite immediately, it lists the suite's test cases (from the latest full-suite
 * run's report) with checkboxes so the user can run one, several, or all of
 * them. Confirm dispatches; Cancel closes without running.
 *
 * The selected filters are joined with spaces and passed as `test_filter`; the
 * workflow forwards them as positional args to `playwright test`, which treats
 * each as an OR filter. When every test is selected we send `null` instead so
 * the run stays a true full-suite run (no filter) — keeping it usable as the
 * test-catalog source and keeping the run-name short.
 */
export function RunTestsModal({
  workflowId,
  workflowName,
  onConfirm,
  onClose,
}: {
  workflowId: number;
  workflowName: string;
  // `null` filter = run the whole suite; a string = run those test(s).
  onConfirm: (filter: string | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { data: runsData } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher);

  // Same selection rule as the per-suite page: newest completed full-suite run
  // (success/failure, no test_filter) is the source of the test catalog.
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

  // Distinct filters available (two tests can share a file:line across projects).
  const allFilters = useMemo(
    () => Array.from(new Set(tests.map(testFilter))),
    [tests]
  );
  const allSelected = allFilters.length > 0 && selected.size === allFilters.length;

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleOne = (filter: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === allFilters.length ? new Set() : new Set(allFilters)
    );
  };

  const handleConfirm = async () => {
    if (submitting || selected.size === 0) return;
    setSubmitting(true);
    // Every test selected → run the whole suite with no filter; otherwise pass
    // the chosen filters space-joined.
    await onConfirm(allSelected ? null : Array.from(selected).join(" "));
    // Parent unmounts the modal on confirm, so no need to reset state.
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-surface-border bg-surface-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="border-b border-surface-border px-5 py-4">
          <h3 className="text-base font-semibold text-white">{t("runModal.title")}</h3>
          <p className="mt-0.5 truncate text-xs text-gray-500">{workflowName}</p>
        </div>

        {/* test list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {isLoading && latestRunId ? (
            <p className="py-6 text-center text-sm text-gray-500">{t("runModal.loading")}</p>
          ) : tests.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{t("runModal.empty")}</p>
          ) : (
            <div className="space-y-1">
              {/* "Select all" — checking every test makes Run dispatch the
                  whole suite with no filter (see handleConfirm). */}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5 transition hover:bg-surface-hover">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-500"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="text-sm font-medium text-white">{t("runModal.allTests")}</span>
              </label>

              {tests.map((test) => {
                const filter = testFilter(test);
                const key = `${filter}::${test.project}`;
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-border px-3 py-2.5 transition hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-indigo-500"
                      checked={selected.has(filter)}
                      onChange={() => toggleOne(filter)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {test.titlePath.join(" › ")}
                      </span>
                      <span className="block truncate font-mono text-xs text-gray-500">
                        {filter}
                        {test.project ? ` · ${test.project}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-surface-border px-4 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            {t("runModal.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t("runModal.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
