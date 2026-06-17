import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import type { WorkflowSummary, WorkflowsResponse } from "@/lib/types";

export async function GET() {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<WorkflowsResponse>({
      configured: false,
      workflows: [],
    });
  }

  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/workflows`
  );

  if (!res.ok) {
    return NextResponse.json<WorkflowsResponse>(
      {
        configured: true,
        workflows: [],
        error: `GitHub API error: ${res.status} ${res.statusText}`,
      },
      { status: 502 }
    );
  }

  const data = await res.json();
  const workflows: WorkflowSummary[] = (data.workflows ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
    htmlUrl: w.html_url,
  }));

  return NextResponse.json<WorkflowsResponse>({ configured: true, workflows });
}
