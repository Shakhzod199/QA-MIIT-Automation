import Link from "next/link";
import { ChevronRightIcon, ExternalLinkIcon, FlaskIcon } from "@/components/icons";
import { formatDateTime, formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

const STATUS_DOT: Record<string, string> = {
  success: "#3ddc97",
  failure: "#ff5d5d",
  cancelled: "#f5b544",
};

export function ReportCard({ run }: { run: RunSummary }) {
  const badge = getStatusBadge(run.status, run.conclusion);
  const reportReady = run.status === "completed";
  const dotColor =
    run.status === "in_progress"
      ? "#5b9dff"
      : run.status === "queued"
      ? "#5b636e"
      : STATUS_DOT[run.conclusion ?? ""] ?? "#5b636e";

  return (
    <div className="flex flex-col justify-between rounded-[12px] border border-surface-border bg-surface-panel p-4 transition hover:border-[rgba(61,220,151,0.2)]">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
            <h3 className="truncate text-[13px] font-semibold text-q-text">{run.name}</h3>
          </div>
          <span className={`shrink-0 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-q-dim">
          #{run.runNumber} · {formatDateTime(run.createdAt)}
        </p>
        <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-q-muted">
          <span>{run.branch ?? "—"}</span>
          <span>{formatDuration(run.durationSec)}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-q-dim">{formatRelativeTime(run.createdAt)}</p>
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-surface-border pt-3 text-[12px] font-medium">
        {reportReady ? (
          <Link
            href={`/reports/${run.id}/results`}
            className="flex items-center gap-1.5 text-q-green transition hover:opacity-80"
            title="View Playwright HTML report"
          >
            <FlaskIcon className="h-3.5 w-3.5" />
            Test Results
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 text-q-dim" title="Available once the run completes">
            <FlaskIcon className="h-3.5 w-3.5" />
            Test Results
          </span>
        )}
        <Link href={`/reports/${run.id}`} className="flex items-center gap-1 text-q-sub transition hover:text-q-text">
          Details
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 text-q-dim transition hover:text-q-muted"
        >
          GitHub
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
