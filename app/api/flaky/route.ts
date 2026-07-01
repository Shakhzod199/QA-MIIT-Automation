import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapRun } from "@/lib/mappers";
import { getReportFiles, findReportFile } from "@/lib/report-artifact";
import { parsePlaywrightReport } from "@/lib/playwright-report";
import { aggregateFlaky, type RunTests } from "@/lib/flaky";
import type { FlakyResponse, RunSummary } from "@/lib/types";

function empty(extra?: Partial<FlakyResponse>): FlakyResponse {
  return {
    configured: true,
    runsAnalyzed: 0,
    windowRequested: 0,
    generatedAt: new Date().toISOString(),
    tests: [],
    ...extra,
  };
}

// This endpoint downloads + unzips a report artifact per analyzed run — real
// work, ~1-2s per run even with lib/report-artifact.ts's per-artifact cache.
// It's also fetched on every page load (sidebar flaky-count badge), so cache
// the whole aggregated response per `limit` for a few minutes.
const resultCache = new Map<number, { data: FlakyResponse; at: number }>();
const RESULT_TTL_MS = 3 * 60 * 1000;

export async function GET(request: Request) {
  const config = getGithubConfig();
  if (!config.configured) {
    return NextResponse.json<FlakyResponse>({ ...empty(), configured: false });
  }

  const { searchParams } = new URL(request.url);
  // How many recent completed runs to analyze. Bounded to keep artifact
  // downloads in check until persistence (#3) removes the need to re-fetch.
  const limit = Math.min(20, Math.max(2, Number(searchParams.get("limit") ?? "10")));

  const cached = resultCache.get(limit);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) {
    return NextResponse.json<FlakyResponse>(cached.data);
  }

  const runsRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs?per_page=40`
  );
  if (!runsRes.ok) {
    return NextResponse.json<FlakyResponse>(
      empty({ windowRequested: limit, error: `GitHub API error: ${runsRes.status} ${runsRes.statusText}` }),
      { status: 502 }
    );
  }

  const data = await runsRes.json();
  const completed: RunSummary[] = (data.workflow_runs ?? [])
    .map(mapRun)
    .filter((r: RunSummary) => r.status === "completed")
    .slice(0, limit);

  // Fetch + parse each run's results.json. Runs without a (non-expired)
  // report artifact resolve to null and are dropped.
  const parsed = await Promise.all(
    completed.map(async (run): Promise<RunTests | null> => {
      const files = await getReportFiles(String(run.id), config);
      if (!files) return null;
      const raw = findReportFile(files, "results.json");
      if (!raw) return null;
      const report = parsePlaywrightReport(new TextDecoder().decode(raw));
      if (!report) return null;
      return {
        runId: run.id,
        runNumber: run.runNumber,
        createdAt: run.createdAt,
        tests: report.tests,
      };
    })
  );

  const valid = parsed.filter((r): r is RunTests => r !== null);

  const result: FlakyResponse = {
    configured: true,
    runsAnalyzed: valid.length,
    windowRequested: limit,
    generatedAt: new Date().toISOString(),
    tests: aggregateFlaky(valid),
  };
  resultCache.set(limit, { data: result, at: Date.now() });

  return NextResponse.json<FlakyResponse>(result);
}
