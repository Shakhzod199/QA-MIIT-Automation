import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapArtifact, mapJob, mapRunDetail } from "@/lib/mappers";
import type { RunDetailResponse } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<RunDetailResponse>({
      configured: false,
      jobs: [],
      artifacts: [],
    });
  }

  const { id } = params;
  const base = `/repos/${config.owner}/${config.repo}/actions/runs/${id}`;

  const [runRes, jobsRes, artifactsRes] = await Promise.all([
    githubFetch(base),
    githubFetch(`${base}/jobs`),
    githubFetch(`${base}/artifacts`),
  ]);

  if (!runRes.ok) {
    return NextResponse.json<RunDetailResponse>(
      {
        configured: true,
        jobs: [],
        artifacts: [],
        error: `GitHub API error: ${runRes.status} ${runRes.statusText}`,
      },
      { status: 502 }
    );
  }

  const runData = await runRes.json();
  const jobsData = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
  const artifactsData = artifactsRes.ok ? await artifactsRes.json() : { artifacts: [] };

  return NextResponse.json<RunDetailResponse>({
    configured: true,
    run: mapRunDetail(runData),
    jobs: (jobsData.jobs ?? []).map(mapJob),
    artifacts: (artifactsData.artifacts ?? []).map(mapArtifact),
  });
}
