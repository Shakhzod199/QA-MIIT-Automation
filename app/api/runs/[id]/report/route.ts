import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapArtifact } from "@/lib/mappers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json({ error: "GitHub is not configured." }, { status: 400 });
  }

  const { id } = await params;

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
      !artifact.expired &&
      (artifact.name === "allure-report" ||
        artifact.name === "playwright-report" ||
        artifact.name.toLowerCase().includes("report"))
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
