"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { formatDuration, formatRelativeTime } from "@/lib/format";
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
  if (run.status === "in_progress") {
    const elapsed = (Date.now() - new Date(run.createdAt).getTime()) / 1000;
    // Cap below 100% so the bar never looks "done" before the run actually finishes.
    const pct = Math.min(95, Math.max(4, (elapsed / estimateSec) * 100));
    return (
      <div className="h-0.5 w-full bg-surface-border">
        <div
          className="h-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)] transition-[width] duration-1000 ease-linear motion-safe:animate-pulse"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  if (run.status === "queued") {
    return (
      <div className="h-0.5 w-full bg-surface-border">
        <div className="h-full w-1/6 bg-gray-500 motion-safe:animate-pulse" />
      </div>
    );
  }

  const color =
    run.conclusion === "success"
      ? "bg-emerald-500"
      : run.conclusion === "failure"
      ? "bg-red-500"
      : run.conclusion === "cancelled"
      ? "bg-amber-500"
      : "bg-gray-600";

  return (
    <div className="h-0.5 w-full bg-surface-border">
      <div className={`h-full w-full ${color}`} />
    </div>
  );
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300 ring-1 ring-inset ring-blue-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
        Running
      </span>
    );
  }

  if (status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/15 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Queued
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
          Passed
        </span>
      );
    case "failure":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
          </svg>
          Cancelled
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

export function RunsTable({ runs, hideProject = false }: { runs: RunSummary[]; hideProject?: boolean }) {
  const hasActiveRun = runs.some((run) => run.status !== "completed");
  useTicker(hasActiveRun);
  const estimateSec = estimateDurationSec(runs);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
        No runs yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Run</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Triggered</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <Fragment key={run.id}>
            <tr className="hover:bg-surface-hover transition-colors">
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
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={run.status} conclusion={run.conclusion} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-gray-400 ring-1 ring-inset ring-surface-border">
                  <svg className="h-3 w-3 opacity-60" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 3a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3V6a3 3 0 00-3-3H6zm5 4a1 1 0 012 0v4.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 0110 12V7z" clipRule="evenodd" fillRule="evenodd" />
                  </svg>
                  {run.branch ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-400">{formatDuration(run.durationSec)}</td>
              <td className="px-4 py-3 text-gray-500">{formatRelativeTime(run.createdAt)}</td>
              <td className="px-4 py-3 text-right">
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
              </td>
            </tr>
            <tr>
              <td colSpan={6} className="p-0">
                <RunProgressBar run={run} estimateSec={estimateSec} />
              </td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
