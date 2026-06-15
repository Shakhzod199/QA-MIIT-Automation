export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "No runs yet";

  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;

  const diffDay = Math.round(diffHr / 24);
  return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface StatusBadge {
  label: string;
  className: string;
}

export function getStatusBadge(status: string, conclusion: string | null): StatusBadge {
  if (status !== "completed") {
    return status === "in_progress"
      ? { label: "Running", className: "bg-blue-500/20 text-blue-300" }
      : { label: "Queued", className: "bg-gray-500/20 text-gray-300" };
  }

  switch (conclusion) {
    case "success":
      return { label: "Passed", className: "bg-green-500/20 text-green-300" };
    case "failure":
      return { label: "Failed", className: "bg-red-500/20 text-red-300" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-gray-500/20 text-gray-300" };
    default:
      return { label: conclusion ?? "Unknown", className: "bg-gray-500/20 text-gray-300" };
  }
}
