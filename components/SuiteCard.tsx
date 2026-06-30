"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { getSuiteDisabledReason } from "@/lib/disabledSuites";
import type { WorkflowSummary } from "@/lib/types";

export function SuiteCard({
  workflow,
  onRun,
  isRunning = false,
  showRunButton = true,
  showRunSeparately = true,
}: {
  workflow: WorkflowSummary;
  // `filter` omitted → run the whole suite; provided → run that single test.
  // Only required when `showRunButton` is true.
  onRun?: (
    workflowId: number,
    filter?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  // True while this workflow has a queued/in-progress run (from polled run data).
  isRunning?: boolean;
  // Set both false for a purely informational card (e.g. on a page that
  // already has its own scoped run controls).
  showRunButton?: boolean;
  showRunSeparately?: boolean;
}) {
  const { t } = useI18n();
  // Local "pending" bridges the gap between clicking and the dispatched run
  // showing up in the polled run list. Once the server reports the run as
  // active (isRunning), we hand off to that as the source of truth.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isRunning) setPending(false);
  }, [isRunning]);

  const disabledReason = getSuiteDisabledReason(workflow.name);

  // The run stays disabled for its whole lifetime, not just a few seconds.
  const busy = pending || isRunning || !!disabledReason;

  // "Run" dispatches the whole suite (all tests). To run a subset, or pick
  // API/K6 test types, use the sidebar's "Test cases" project menu.
  const handleRun = async () => {
    if (busy || !onRun || disabledReason) return;
    setPending(true);
    setError(null);

    const result = await onRun(workflow.id);

    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "Failed to trigger run");
    }
    // On success we keep `pending` until the run appears in polled data and
    // `isRunning` takes over (see the effect above).
  };

  return (
    <div className="flex flex-col justify-between rounded-[12px] border border-surface-border bg-surface-panel p-4 transition hover:border-[rgba(61,220,151,0.2)]">
      <div>
        <h3 className="text-[13px] font-semibold text-q-text">{workflow.name}</h3>
        {workflow.state !== "active" && (
          <p className="mt-1 text-[11px] text-q-amber">workflow is {workflow.state}</p>
        )}
        {disabledReason && <p className="mt-1 text-[11px] text-q-amber">{disabledReason}</p>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <a
          href={workflow.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] text-q-dim transition hover:text-q-muted"
        >
          {t("suite.viewOnGithub")}
        </a>
        <div className="flex items-center gap-2">
          {showRunSeparately && (
            <Link
              href={`/suites/${workflow.id}`}
              className="inline-flex items-center rounded-[8px] border border-surface-border px-3 py-1.5 text-[12px] font-medium text-q-sub transition hover:border-[rgba(255,255,255,0.15)] hover:text-q-text"
            >
              {t("suite.runSeparately")}
            </Link>
          )}
          {showRunButton && (
            <button
              onClick={handleRun}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "#3ddc97", color: "#06140d" }}
            >
              {busy && (
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {busy ? t("suite.running") : t("suite.run")}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] text-q-red">{error}</p>}
    </div>
  );
}
