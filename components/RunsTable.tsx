"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";
import { FlaskIcon } from "@/components/icons";
import type { RunSummary } from "@/lib/types";

// Re-render every second while a run is active so the progress bar animates smoothly
// between the 15s data refreshes.
function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

// Estimate how long a run takes from the median duration of this suite's completed runs.
function estimateDurationSec(runs: RunSummary[]): number {
  const durations = runs
    .filter((r) => r.status === "completed" && r.durationSec != null)
    .map((r) => r.durationSec as number)
    .sort((a, b) => a - b);
  if (durations.length === 0) return 90; // sensible default until we have history
  return durations[Math.floor(durations.length / 2)];
}

function RunProgressBar({ run, estimateSec }: { run: RunSummary; estimateSec: number }) {
  let pct: number;
  let fill: string;
  let label: string;
  let animate = false;

  if (run.status === "in_progress") {
    const elapsed = (Date.now() - new Date(run.createdAt).getTime()) / 1000;
    // Cap below 100% so the bar never looks "done" before the run actually finishes.
    pct = Math.min(95, Math.max(4, (elapsed / estimateSec) * 100));
    fill = "bg-blue-500";
    label = `${Math.round(pct)}%`;
    animate = true;
  } else if (run.status === "queued") {
    pct = 8;
    fill = "bg-gray-500";
    label = "Queued";
    animate = true;
  } else {
    pct = 100;
    fill =
      run.conclusion === "success"
        ? "bg-emerald-500"
        : run.conclusion === "failure"
        ? "bg-red-500"
        : run.conclusion === "cancelled"
        ? "bg-amber-500"
        : "bg-gray-600";
    label = "100%";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-border ring-1 ring-inset ring-surface-border">
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-1000 ease-linear ${animate ? "motion-safe:animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  const { t } = useI18n();
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300 ring-1 ring-inset ring-blue-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
        {t("status.running")}
      </span>
    );
  }

  if (status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {t("status.queued")}
      </span>
    );
  }

  switch (conclusion) {
    case "success":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {t("status.passed")}
        </span>
      );
    case "failure":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t("status.failed")}
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
          </svg>
          {t("status.cancelled")}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
          {conclusion ?? "Unknown"}
        </span>
      );
  }
}

function CancelButton({
  runId,
  onCancel,
}: {
  runId: number;
  onCancel: (runId: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "cancelling" | "error">("idle");

  const handleClick = async () => {
    setState("cancelling");
    const result = await onCancel(runId);
    // On success the row flips to "completed/cancelled" on the next refresh; keep
    // the button disabled meanwhile. On failure, surface it via title + reset.
    setState(result.ok ? "cancelling" : "error");
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "cancelling"}
      title={state === "error" ? "Cancel failed — try again" : "Cancel this run"}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-60 ${
        state === "error"
          ? "bg-red-500/10 text-red-300 ring-red-500/40"
          : "text-red-300 ring-red-500/30 hover:bg-red-500/15"
      }`}
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="1.5" strokeWidth={2} />
      </svg>
      {state === "cancelling" ? t("table.cancelling") : t("table.cancel")}
    </button>
  );
}

export function RunsTable({
  runs,
  hideProject = false,
  pageSize = 5,
  onCancel,
}: {
  runs: RunSummary[];
  hideProject?: boolean;
  pageSize?: number;
  onCancel?: (runId: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { t } = useI18n();
  const hasActiveRun = runs.some((run) => run.status !== "completed");
  useTicker(hasActiveRun);
  const estimateSec = estimateDurationSec(runs);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(runs.length / pageSize));
  // Clamp in case the run count shrank (e.g. data refresh) below the current page.
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const visibleRuns = runs.slice(start, start + pageSize);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        {t("dashboard.noRuns")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
      <table className="w-full table-fixed text-left text-sm">
        {/* Fixed column widths so every project's table lines up identically,
            regardless of each table's own content. */}
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">{t("table.run")}</th>
            <th className="px-4 py-3">{t("table.status")}</th>
            <th className="px-4 py-3">{t("table.progress")}</th>
            <th className="px-4 py-3">{t("table.branch")}</th>
            <th className="px-4 py-3">{t("table.duration")}</th>
            <th className="px-4 py-3">{t("table.triggered")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visibleRuns.map((run) => (
            <tr key={run.id} className="border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/reports/${run.id}`}
                  className="group flex items-center gap-1.5"
                >
                  {!hideProject && (
                    <span className="text-gray-400 group-hover:text-gray-200 transition-colors">
                      {run.name}
                    </span>
                  )}
                  <span className="font-mono text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    #{run.runNumber}
                  </span>
                </Link>
                {run.testFilter && (
                  <span
                    title={run.testFilter}
                    className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30"
                  >
                    <FlaskIcon className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{t("table.singleTest")}</span>
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={run.status} conclusion={run.conclusion} />
              </td>
              <td className="px-4 py-3">
                <RunProgressBar run={run} estimateSec={estimateSec} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-gray-400 ring-1 ring-inset ring-surface-border">
                  <svg className="h-3 w-3 shrink-0 opacity-60" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 3a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3V6a3 3 0 00-3-3H6zm5 4a1 1 0 012 0v4.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 0110 12V7z" clipRule="evenodd" fillRule="evenodd" />
                  </svg>
                  <span className="truncate">{run.branch ?? "—"}</span>
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.status === "in_progress" ? (
                  <span className="text-blue-300">
                    {formatDuration(Math.max(0, Math.floor((Date.now() - new Date(run.createdAt).getTime()) / 1000)))}
                  </span>
                ) : (
                  <span className="text-gray-400">{formatDuration(run.durationSec)}</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500">{formatRelativeTime(run.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {onCancel && run.status !== "completed" && (
                    <CancelButton runId={run.id} onCancel={onCancel} />
                  )}
                  <a
                  href={run.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="View on GitHub"
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition hover:bg-surface-hover hover:text-gray-200"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-border px-4 py-2.5 text-xs text-gray-500">
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + pageSize, runs.length)} {t("table.of")} {runs.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="rounded-md px-2.5 py-1 font-medium text-gray-400 transition hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ← {t("table.prev")}
            </button>
            <span className="px-1.5 tabular-nums text-gray-400">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md px-2.5 py-1 font-medium text-gray-400 transition hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {t("table.next")} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
