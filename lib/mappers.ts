import type { ArtifactSummary, JobStep, JobSummary, RunDetail, RunSummary } from "@/lib/types";

function durationBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

// run-name encodes a single-test filter as "<Suite> — <filter>". Split it back
// so `name` stays the bare suite (keeps grouping/trends stable) and the filter
// surfaces separately.
const RUN_NAME_SEP = " — ";

// Non-default test types encode as "<Suite> [type]" before the filter suffix
// above. Absent (older runs, or default "frontend" dispatches) → "frontend".
const TYPE_SUFFIX_RE = / \[(frontend|api|load)\]$/;

export function mapRun(run: any): RunSummary {
  const rawName = run.name ?? run.display_title ?? "Run";
  const sep = rawName.indexOf(RUN_NAME_SEP);
  const beforeFilter = sep >= 0 ? rawName.slice(0, sep) : rawName;
  const testFilter = sep >= 0 ? rawName.slice(sep + RUN_NAME_SEP.length) : null;

  const typeMatch = beforeFilter.match(TYPE_SUFFIX_RE);
  const runType = (typeMatch?.[1] as RunSummary["runType"]) ?? "frontend";
  const name = typeMatch ? beforeFilter.slice(0, typeMatch.index) : beforeFilter;

  return {
    id: run.id,
    name,
    runNumber: run.run_number,
    workflowId: run.workflow_id,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    createdAt: run.created_at,
    durationSec: run.status === "completed" ? durationBetween(run.run_started_at, run.updated_at) : null,
    htmlUrl: run.html_url,
    testFilter,
    runType,
  };
}

export function mapRunDetail(run: any): RunDetail {
  return {
    ...mapRun(run),
    event: run.event,
    actor: run.triggering_actor?.login ?? run.actor?.login ?? null,
    updatedAt: run.updated_at,
  };
}

export function mapJobStep(step: any): JobStep {
  return {
    name: step.name,
    status: step.status,
    conclusion: step.conclusion,
    number: step.number,
    durationSec: durationBetween(step.started_at, step.completed_at),
  };
}

export function mapJob(job: any): JobSummary {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    durationSec: durationBetween(job.started_at, job.completed_at),
    htmlUrl: job.html_url,
    steps: (job.steps ?? []).map(mapJobStep),
  };
}

export function mapArtifact(artifact: any): ArtifactSummary {
  return {
    id: artifact.id,
    name: artifact.name,
    sizeInBytes: artifact.size_in_bytes,
    expired: artifact.expired,
  };
}
