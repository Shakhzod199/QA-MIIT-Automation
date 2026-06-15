import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

export function ReportCard({ run }: { run: RunSummary }) {
  const badge = getStatusBadge(run.status, run.conclusion);

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
      <div className="mt-4 flex items-center gap-3 border-t border-surface-border pt-3">
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          View run →
        </a>
        <span className="text-xs text-gray-500">Report artifact under "Artifacts" on the run page</span>
      </div>
    </div>
  );
}
