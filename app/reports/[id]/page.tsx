"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ClipboardCheckIcon, ExternalLinkIcon, FlaskIcon } from "@/components/icons";
import { TestResults } from "@/components/TestResults";
import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunDetailResponse, TestReportResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useSWR<RunDetailResponse>(`/api/runs/${id}`, fetcher, {
    // Poll fast while this specific run is still live, so "still running" on
    // screen can't lag behind what GitHub/Telegram already reported for long.
    refreshInterval: (latest) =>
      latest?.run?.status === "in_progress" || latest?.run?.status === "queued" ? 5000 : 15000,
  });
  // Test-level results only exist once the run has finished and uploaded its
  // report artifact, so only fetch them for completed runs.
  const { data: testsData } = useSWR<TestReportResponse>(
    data?.run?.status === "completed" ? `/api/runs/${id}/tests` : null,
    fetcher
  );

  if (!data) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!data.configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
        GitHub is not configured yet. Set <code>GITHUB_TOKEN</code>, <code>GITHUB_OWNER</code>, and{" "}
        <code>GITHUB_REPO</code> in <code>dashboard/.env.local</code>.
      </div>
    );
  }

  if (data.error || !data.run) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {data.error ?? "Run not found."}
      </div>
    );
  }

  const { run, jobs, artifacts } = data;
  const badge = getStatusBadge(run.status, run.conclusion);
  const hasReport = artifacts.some(
    (artifact) => artifact.name.toLowerCase().includes("report") && !artifact.expired
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/reports" className="hover:text-white">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-white">Run #{run.runNumber}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-panel p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{run.name}</h2>
            <p className="mt-1 text-sm text-gray-500">Triggered by {run.event} event</p>
          </div>
          <a
            href={run.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 hover:text-white"
            title="View on GitHub"
          >
            <ExternalLinkIcon className="h-5 w-5" />
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Run Number</p>
            <p className="mt-1 text-sm text-gray-200">#{run.runNumber}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Branch</p>
            <p className="mt-1 text-sm text-gray-200">{run.branch ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Duration</p>
            <p className="mt-1 text-sm text-gray-200">{formatDuration(run.durationSec)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Started</p>
            <p className="mt-1 text-sm text-gray-200">{formatDateTime(run.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Updated</p>
            <p className="mt-1 text-sm text-gray-200">{formatRelativeTime(run.updatedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Triggered by</p>
            <p className="mt-1 text-sm text-gray-200">{run.actor ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
            <FlaskIcon className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Playwright Test Report</h3>
            <p className="mt-0.5 text-sm text-gray-400">
              {hasReport
                ? "Interactive report with pass/fail details, traces, and screenshots."
                : run.status !== "completed"
                  ? "Report will be available once this run finishes."
                  : "No report artifact found — it may have expired."}
            </p>
          </div>
        </div>
        {hasReport ? (
          <Link
            href={`/reports/${run.id}/results`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Report
          </Link>
        ) : (
          <span className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-surface-hover px-5 py-2.5 text-sm font-medium text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {run.status !== "completed" ? "In progress…" : "Not available"}
          </span>
        )}
      </div>

      {testsData?.available && testsData.tests.length > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
              <ClipboardCheckIcon className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Plain-Language Results</h3>
              <p className="mt-0.5 text-sm text-gray-400">
                A non-technical, test-by-test summary — easier to share with stakeholders.
              </p>
            </div>
          </div>
          <Link
            href={`/reports/${run.id}/summary`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 active:scale-95"
          >
            <ClipboardCheckIcon className="h-4 w-4" />
            View Results
          </Link>
        </div>
      )}

      {testsData?.available && testsData.tests.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Tests</h3>
            <span className="text-sm text-gray-500">{testsData.summary.total} test{testsData.summary.total !== 1 ? "s" : ""}</span>
          </div>
          <TestResults summary={testsData.summary} tests={testsData.tests} />
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Jobs</h3>
          <span className="text-sm text-gray-500">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
        </div>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            No jobs found for this run yet.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const jobBadge = getStatusBadge(job.status, job.conclusion);
              return (
                <div key={job.id} className="rounded-lg border border-surface-border bg-surface-panel">
                  <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
                    <h4 className="font-medium text-white">{job.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{formatDuration(job.durationSec)}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${jobBadge.className}`}>
                        {jobBadge.label}
                      </span>
                      <a
                        href={job.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-500 hover:text-white"
                        title="View job on GitHub"
                      >
                        <ExternalLinkIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  <div className="overflow-x-auto px-4 py-4">
                    <div className="flex min-w-max items-center gap-0">
                      {job.steps.map((step, idx) => {
                        const isSuccess = step.conclusion === "success";
                        const isFailure = step.conclusion === "failure";
                        const isSkipped = step.conclusion === "skipped";
                        const isRunning = step.status === "in_progress";
                        return (
                          <div key={step.number} className="flex items-center">
                            <div
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                                isFailure
                                  ? "border-red-500/40 bg-red-500/10"
                                  : isSuccess
                                    ? "border-green-500/30 bg-green-500/5"
                                    : isRunning
                                      ? "border-blue-500/40 bg-blue-500/10"
                                      : "border-surface-border bg-surface-hover"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  isFailure
                                    ? "bg-red-500 text-white"
                                    : isSuccess
                                      ? "bg-green-500 text-white"
                                      : isRunning
                                        ? "bg-blue-500 text-white"
                                        : isSkipped
                                          ? "bg-gray-600 text-gray-300"
                                          : "bg-gray-600 text-gray-300"
                                }`}
                              >
                                {isFailure ? "✕" : isSuccess ? "✓" : isRunning ? "●" : "–"}
                              </span>
                              <span className={`max-w-[140px] truncate font-medium ${isFailure ? "text-red-300" : isSuccess ? "text-gray-200" : "text-gray-400"}`}>
                                {step.name}
                              </span>
                              {step.durationSec != null && step.durationSec > 0 && (
                                <span className={`shrink-0 ${isFailure ? "text-red-400" : "text-gray-500"}`}>
                                  {formatDuration(step.durationSec)}
                                </span>
                              )}
                            </div>
                            {idx < job.steps.length - 1 && (
                              <span className="mx-1 shrink-0 text-gray-600">→</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
