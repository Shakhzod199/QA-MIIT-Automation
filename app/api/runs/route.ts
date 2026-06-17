import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapRun } from "@/lib/mappers";
import type { RunStats, RunSummary, RunsResponse } from "@/lib/types";

function emptyStats(): RunStats {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    completed: 0,
    passRate: 0,
    failRate: 0,
    lastRunAt: null,
  };
}

function computeStats(runs: RunSummary[]): RunStats {
  if (runs.length === 0) return emptyStats();

  let passed = 0;
  let failed = 0;
  let completed = 0;

  for (const run of runs) {
    if (run.status !== "completed") continue;
    completed += 1;
    if (run.conclusion === "success") passed += 1;
    else if (run.conclusion === "failure") failed += 1;
  }

  return {
    total: runs.length,
    passed,
    failed,
    completed,
    passRate: completed > 0 ? Math.round((passed / completed) * 100) : 0,
    failRate: completed > 0 ? Math.round((failed / completed) * 100) : 0,
    lastRunAt: runs[0]?.createdAt ?? null,
  };
}

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
