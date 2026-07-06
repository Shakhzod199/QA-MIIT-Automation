import type { RunsResponse } from "@/lib/types";

/**
 * SWR `refreshInterval` for the runs list: fast while something is actually
 * live (so "still running" on screen doesn't lag behind what GitHub/Telegram
 * already know for tens of seconds), slower otherwise to conserve GitHub API
 * quota. Pass directly as `refreshInterval` — SWR re-evaluates it against the
 * latest fetched data after every poll.
 */
export function runsRefreshInterval(data: RunsResponse | undefined): number {
  const hasActiveRun = (data?.runs ?? []).some((r) => r.status === "in_progress" || r.status === "queued");
  return hasActiveRun ? 5000 : 15000;
}
