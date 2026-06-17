import Link from "next/link";
import { ChevronRightIcon, ExternalLinkIcon, FlaskIcon } from "@/components/icons";
import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

export function ReportCard({ run }: { run: RunSummary }) {
  const badge = getStatusBadge(run.status, run.conclusion);
  const reportReady = run.status === "completed";

  return (
    <div className="flex flex-col justify-between rounded-lg border border-surface-border bg-surface-panel p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-white">{run.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Run #{run.runNumber} · {formatDateTime(run.createdAt)}
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
          <span>{run.branch ?? "—"}</span>
          <span>{formatDuration(run.durationSec)}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{formatRelativeTime(run.createdAt)}</p>
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-surface-border pt-3 text-sm font-medium">
        {reportReady ? (
          <Link
            href={`/reports/${run.id}/results`}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300"
            title="View Playwright HTML report"
          >
            <FlaskIcon className="h-4 w-4" />
            Test Results
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 text-gray-600" title="Available once the run completes">
            <FlaskIcon className="h-4 w-4" />
            Test Results
          </span>
        )}
        <Link href={`/reports/${run.id}`} className="flex items-center gap-1 text-gray-300 hover:text-white">
          Details
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 text-gray-400 hover:text-white"
        >
          GitHub
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
