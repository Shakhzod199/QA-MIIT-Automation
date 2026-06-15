import { formatDuration, formatRelativeTime } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

function statusBadge(run: RunSummary): { label: string; className: string } {
  if (run.status !== "completed") {
    return run.status === "in_progress"
      ? { label: "Running", className: "bg-blue-500/20 text-blue-300" }
      : { label: "Queued", className: "bg-gray-500/20 text-gray-300" };
  }

  switch (run.conclusion) {
    case "success":
      return { label: "Passed", className: "bg-green-500/20 text-green-300" };
    case "failure":
      return { label: "Failed", className: "bg-red-500/20 text-red-300" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-gray-500/20 text-gray-300" };
    default:
      return { label: run.conclusion ?? "Unknown", className: "bg-gray-500/20 text-gray-300" };
  }
}

export function RunsTable({ runs }: { runs: RunSummary[] }) {
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
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const badge = statusBadge(run);
            return (
              <tr key={run.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3">
                  <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {run.name} <span className="text-gray-500">#{run.runNumber}</span>
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{run.branch ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">{formatDuration(run.durationSec)}</td>
                <td className="px-4 py-3 text-gray-400">{formatRelativeTime(run.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
