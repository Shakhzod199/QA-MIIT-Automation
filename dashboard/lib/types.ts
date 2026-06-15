export interface WorkflowSummary {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
}

export interface RunSummary {
  id: number;
  name: string;
  runNumber: number;
  workflowId: number;
  status: string; // "queued" | "in_progress" | "completed"
  conclusion: string | null; // "success" | "failure" | "cancelled" | null
  branch: string | null;
  createdAt: string;
  durationSec: number | null;
  htmlUrl: string;
}

export interface RunStats {
  total: number;
  passed: number;
  failed: number;
  completed: number;
  passRate: number;
  failRate: number;
  lastRunAt: string | null;
}

export interface WorkflowsResponse {
  configured: boolean;
  workflows: WorkflowSummary[];
  error?: string;
}

export interface RunsResponse {
  configured: boolean;
  runs: RunSummary[];
  stats: RunStats;
  error?: string;
}

export interface TriggerResponse {
  ok: boolean;
  error?: string;
}

export interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  durationSec: number | null;
}

export interface JobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  durationSec: number | null;
  htmlUrl: string;
  steps: JobStep[];
}

export interface ArtifactSummary {
  id: number;
  name: string;
  sizeInBytes: number;
  expired: boolean;
}

export interface RunDetail extends RunSummary {
  event: string;
  actor: string | null;
  updatedAt: string;
}

export interface RunDetailResponse {
  configured: boolean;
  run?: RunDetail;
  jobs: JobSummary[];
  artifacts: ArtifactSummary[];
  error?: string;
}
