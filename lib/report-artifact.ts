import JSZip from "jszip";
import { githubFetch } from "@/lib/github";
import { mapArtifact } from "@/lib/mappers";

// Cache extracted zip contents per run ID so multiple consumers (the report
// file server and the parsed-test-results endpoint) don't re-download or
// re-unzip the same artifact. Shared across routes via this module scope.
const cache = new Map<string, { files: Map<string, Uint8Array>; at: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getReportFiles(
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
    .find((a) => a.name.toLowerCase().includes("report") && !a.expired);
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

/**
 * Finds a file in the extracted artifact whose path ends with `suffix`.
 * The zip's internal layout varies (files may sit at the root or under a
 * `playwright-report/` prefix depending on how the workflow uploaded them),
 * so we match on the tail of the path rather than an exact key.
 */
export function findReportFile(
  files: Map<string, Uint8Array>,
  suffix: string
): Uint8Array | undefined {
  const direct = files.get(suffix);
  if (direct) return direct;
  for (const [path, content] of files) {
    if (path === suffix || path.endsWith(`/${suffix}`)) return content;
  }
  return undefined;
}
