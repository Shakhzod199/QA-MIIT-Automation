"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { WorkflowSummary } from "@/lib/types";

type TestType = "frontend" | "api" | "load";

export function SuiteCard({
  workflow,
  onRun,
  isRunning = false,
}: {
  workflow: WorkflowSummary;
  // `filter` omitted → run the whole suite; provided → run that single test.
  // `type` selects frontend/api/load (defaults to "frontend" server-side).
  onRun: (
    workflowId: number,
    filter?: string,
    type?: TestType
  ) => Promise<{ ok: boolean; error?: string }>;
  // True while this workflow has a queued/in-progress run (from polled run data).
  isRunning?: boolean;
}) {
  const { t } = useI18n();
  // Local "pending" bridges the gap between clicking and the dispatched run
  // showing up in the polled run list. Once the server reports the run as
  // active (isRunning), we hand off to that as the source of truth.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TestType>("frontend");

  useEffect(() => {
    if (isRunning) setPending(false);
  }, [isRunning]);

  // The run stays disabled for its whole lifetime, not just a few seconds.
  const busy = pending || isRunning;

  // "Run" dispatches the whole suite (all tests) for the selected type. To
  // run a subset of frontend tests, use "Run separately".
  const handleRun = async () => {
    if (busy) return;
    setPending(true);
    setError(null);

    const result = await onRun(workflow.id, undefined, type);

    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "Failed to trigger run");
    }
    // On success we keep `pending` until the run appears in polled data and
    // `isRunning` takes over (see the effect above).
  };

  return (
    <div className="flex flex-col justify-between rounded-lg border border-surface-border bg-surface-panel p-4">
      <div>
        <h3 className="font-medium text-white">{workflow.name}</h3>
        <p className="mt-1 text-xs text-gray-500">{workflow.path}</p>
        {workflow.state !== "active" && (
          <p className="mt-1 text-xs text-amber-500">workflow is {workflow.state}</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <a
          href={workflow.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {t("suite.viewOnGithub")}
        </a>
        <div className="flex items-center gap-2">
          <Link
            href={`/suites/${workflow.id}`}
            className="inline-flex items-center rounded-md border border-surface-border px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            {t("suite.runSeparately")}
          </Link>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TestType)}
            disabled={busy}
            aria-label={t("suite.testType")}
            className="rounded-md border border-surface-border bg-surface-panel px-2 py-1.5 text-sm text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <optgroup label={t("suite.frontend")}>
              <option value="frontend">{t("suite.frontend")}</option>
            </optgroup>
            <optgroup label={t("suite.backend")}>
              <option value="api">{t("suite.api")}</option>
              <option value="load">{t("suite.load")}</option>
            </optgroup>
          </select>
          <button
            onClick={handleRun}
            disabled={busy}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed",
              "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70",
            ].join(" ")}
          >
            {busy && (
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
            {busy ? t("suite.running") : t("suite.run")}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
