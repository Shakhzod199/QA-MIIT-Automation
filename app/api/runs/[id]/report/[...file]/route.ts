import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapArtifact } from "@/lib/mappers";

// Cache extracted zip contents per run ID so multiple file requests
// (index.html, JS chunks, data/*.json) don't re-download the same zip.
const cache = new Map<string, { files: Map<string, Uint8Array>; at: number }>();
const TTL_MS = 5 * 60 * 1000;

async function getReportFiles(
  runId: string,
  config: { owner?: string; repo?: string }
): Promise<Map<string, Uint8Array> | null> {
  const entry = cache.get(runId);
  if (entry && Date.now() - entry.at < TTL_MS) return entry.files;

  const artifactsRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs/${runId}/artifacts`
  );
  if (!artifactsRes.ok) return null;

  const { artifacts = [] } = await artifactsRes.json();
  const report = (artifacts as any[])
    .map(mapArtifact)
    .find(
      (a) =>
        !a.expired &&
        (a.name === "allure-report" ||
          a.name === "playwright-report" ||
          a.name.toLowerCase().includes("report"))
    );
  if (!report) return null;

  const zipRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/artifacts/${report.id}/zip`
  );
  if (!zipRes.ok || !zipRes.body) return null;

  const arrayBuffer = await zipRes.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const files = new Map<string, Uint8Array>();
  await Promise.all(
    Object.entries(zip.files)
      .filter(([, entry]) => !entry.dir)
      .map(async ([path, entry]) => {
        files.set(path, await entry.async("uint8array"));
      })
  );

  cache.set(runId, { files, at: Date.now() });
  return files;
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  webp: "image/webp",
};

function contentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; file: string[] }> }
) {
  const config = getGithubConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "GitHub is not configured." }, { status: 400 });
  }

  const { id, file } = await params;
  const filePath = file.join("/");

  const files = await getReportFiles(id, config);
  if (!files) {
    return NextResponse.json({ error: "Report artifact not found." }, { status: 404 });
  }

  // Try path as-is first, then common artifact prefixes.
  // Allure zips as allure-report/<file>, Playwright as playwright-report/<file>
  // or bare depending on how upload-artifact was configured.
  const content =
    files.get(filePath) ??
    files.get(`allure-report/${filePath}`) ??
    files.get(`playwright-report/${filePath}`) ??
    (filePath === "index.html" ? files.get("index.html") : undefined);

  if (!content) {
    return NextResponse.json({ error: `File not found in report: ${filePath}` }, { status: 404 });
  }

  return new NextResponse(Buffer.from(content), {
    headers: { "Content-Type": contentType(filePath) },
  });
}
