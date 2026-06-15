"use client";

import Link from "next/link";
import useSWR from "swr";
import { ExternalLinkIcon, FlaskIcon } from "@/components/icons";
import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunDetailResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const { data } = useSWR<RunDetailResponse>(`/api/runs/${params.id}`, fetcher, {
    refreshInterval: 15000,
  });

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

      <div className="flex flex-col gap-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FlaskIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
          <div>
            <h3 className="font-medium text-white">Playwright Test Report</h3>
            <p className="text-sm text-gray-400">
              {hasReport
                ? "Download the HTML report artifact (includes traces, screenshots and failure details)."
                : run.status !== "completed"
                  ? "The report will be available once this run finishes."
                  : "No report artifact was found for this run (it may have expired)."}
            </p>
          </div>
        </div>
        {hasReport ? (
          <a
            href={`/api/runs/${run.id}/report`}
            className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Download Report
          </a>
        ) : (
          <span className="shrink-0 cursor-not-allowed rounded-md bg-surface-hover px-4 py-2 text-center text-sm font-medium text-gray-500">
            Download Report
          </span>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">Jobs</h3>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            No jobs found for this run yet.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const jobBadge = getStatusBadge(job.status, job.conclusion);
              return (
                <div key={job.id} className="rounded-lg border border-surface-border bg-surface-panel p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">{job.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{formatDuration(job.durationSec)}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${jobBadge.className}`}>
                        {jobBadge.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.steps.map((step) => {
                      const stepBadge = getStatusBadge(step.status, step.conclusion);
                      return (
                        <span
                          key={step.number}
                          className={`rounded px-2 py-1 text-xs font-medium ${stepBadge.className}`}
                        >
                          {step.name}
                          {step.durationSec != null ? ` · ${formatDuration(step.durationSec)}` : ""}
                        </span>
                      );
                    })}
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
