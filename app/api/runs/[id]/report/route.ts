import { NextResponse } from "next/server";
import { canAccessWorkflow, getRunWorkflowId } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapArtifact } from "@/lib/mappers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json({ error: "GitHub is not configured." }, { status: 400 });
  }

  const { id } = await params;

  const workflowId = await getRunWorkflowId(id);
  if (workflowId != null && !(await canAccessWorkflow(request, workflowId))) {
    return NextResponse.json({ error: "You don't have access to this project." }, { status: 403 });
  }

  const artifactsRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs/${id}/artifacts`
  );

  if (!artifactsRes.ok) {
    return NextResponse.json(
      { error: `GitHub API error: ${artifactsRes.status} ${artifactsRes.statusText}` },
      { status: 502 }
    );
  }

  const artifactsData = await artifactsRes.json();
  const artifacts = (artifactsData.artifacts ?? []).map(mapArtifact);
  const report = artifacts.find(
    (artifact: { name: string; expired: boolean }) =>
      artifact.name.toLowerCase().includes("report") && !artifact.expired
  );

  if (!report) {
    return NextResponse.json(
      { error: "No Playwright report artifact found for this run." },
      { status: 404 }
    );
  }

  const zipRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/artifacts/${report.id}/zip`
  );

  if (!zipRes.ok || !zipRes.body) {
    return NextResponse.json(
      { error: `Failed to download report artifact: ${zipRes.status} ${zipRes.statusText}` },
      { status: 502 }
    );
  }

  return new NextResponse(zipRes.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${report.name}.zip"`,
    },
  });
}
