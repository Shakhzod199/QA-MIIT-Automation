import { NextResponse } from "next/server";
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
  const runs: RunSummary[] = (data.workflow_runs ?? []).map(mapRun);

  return NextResponse.json<RunsResponse>({
    configured: true,
    runs,
    stats: computeStats(runs),
  });
}
