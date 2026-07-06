import { NextResponse } from "next/server";
import { allowedWorkflowIds } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import type { WorkflowSummary, WorkflowsResponse } from "@/lib/types";

export async function GET(request: Request) {
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

  // Non-admins only see the projects they've been granted; admins are
  // unrestricted (allowed === null). This is the one filter point that makes
  // restricted projects disappear from the sidebar, home page, and Trends
  // everywhere at once, since they all read from this endpoint.
  const allowed = await allowedWorkflowIds(request);
  const visible = allowed === null ? workflows : workflows.filter((w) => allowed.has(w.id));

  return NextResponse.json<WorkflowsResponse>({ configured: true, workflows: visible });
}
