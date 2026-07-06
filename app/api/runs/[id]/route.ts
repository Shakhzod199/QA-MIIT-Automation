import { NextResponse } from "next/server";
import { canAccessWorkflow } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapArtifact, mapJob, mapRunDetail } from "@/lib/mappers";
import type { RunDetailResponse } from "@/lib/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<RunDetailResponse>({
      configured: false,
      jobs: [],
      artifacts: [],
    });
  }

  const { id } = await params;
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

  // The run's own payload already tells us its workflow_id — no extra
  // GitHub call needed here, unlike the run-id-only endpoints below.
  if (!(await canAccessWorkflow(request, runData.workflow_id))) {
    return NextResponse.json<RunDetailResponse>(
      { configured: true, jobs: [], artifacts: [], error: "You don't have access to this project." },
      { status: 403 }
    );
  }

  const jobsData = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
  const artifactsData = artifactsRes.ok ? await artifactsRes.json() : { artifacts: [] };

  return NextResponse.json<RunDetailResponse>({
    configured: true,
    run: mapRunDetail(runData),
    jobs: (jobsData.jobs ?? []).map(mapJob),
    artifacts: (artifactsData.artifacts ?? []).map(mapArtifact),
  });
}
