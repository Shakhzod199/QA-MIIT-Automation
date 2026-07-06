import { NextResponse } from "next/server";
import { allowedWorkflowIds } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapRun } from "@/lib/mappers";
import { computeStats, emptyStats } from "@/lib/stats";
import type { RunSummary, RunsResponse } from "@/lib/types";

export async function GET(request: Request) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<RunsResponse>({
      configured: false,
      runs: [],
      stats: emptyStats(),
    });
  }

  const { searchParams } = new URL(request.url);
  const perPage = searchParams.get("per_page") ?? "20";

  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs?per_page=${perPage}`
  );

  if (!res.ok) {
    return NextResponse.json<RunsResponse>(
      {
        configured: true,
        runs: [],
        stats: emptyStats(),
        error: `GitHub API error: ${res.status} ${res.statusText}`,
      },
      { status: 502 }
    );
  }

  const data = await res.json();
  const allRuns: RunSummary[] = (data.workflow_runs ?? []).map(mapRun);

  // Same restriction as /api/workflows — hides runs from projects this user
  // wasn't granted, so Recent Runs / Trends / Reports never leak them.
  const allowed = await allowedWorkflowIds(request);
  const runs = allowed === null ? allRuns : allRuns.filter((r) => allowed.has(r.workflowId));

  return NextResponse.json<RunsResponse>({
    configured: true,
    runs,
    stats: computeStats(runs),
  });
}
