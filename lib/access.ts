import { getGithubConfig, githubFetch } from "@/lib/github";
import { getUserById } from "@/lib/users";
import type { UserRole } from "@/lib/types";

export interface RequestIdentity {
  id: number;
  role: UserRole;
}

/**
 * Reads the identity middleware.ts already resolved and forwarded as
 * `x-user-*` headers — every route behind middleware has these set. Returns
 * null only if middleware somehow didn't run (defensive, shouldn't happen).
 */
export function getRequestIdentity(request: Request): RequestIdentity | null {
  const idHeader = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role") as UserRole | null;
  if (!idHeader || !role) return null;
  const id = Number(idHeader);
  return Number.isFinite(id) ? { id, role } : null;
}

/**
 * The set of workflow ids this request's user may see/act on, freshly read
 * from the DB (not the possibly-stale signed-cookie claims) so a project
 * grant/revoke takes effect on the very next request. Returns null for
 * admins, meaning "unrestricted" — check for null before treating the
 * result as a allow-list.
 */
export async function allowedWorkflowIds(request: Request): Promise<Set<number> | null> {
  const identity = getRequestIdentity(request);
  if (!identity) return new Set();
  if (identity.role === "admin") return null;
  const user = await getUserById(identity.id);
  return new Set(user?.allowedWorkflows ?? []);
}

/** True if this request's user may see/act on `workflowId`. Admins: always true. */
export async function canAccessWorkflow(request: Request, workflowId: number): Promise<boolean> {
  const allowed = await allowedWorkflowIds(request);
  return allowed === null || allowed.has(workflowId);
}

/**
 * Resolves the workflow id a run belongs to, for endpoints keyed by run id
 * rather than workflow id (cancel, report, tests). One extra GitHub API call
 * — necessary since those endpoints have no other way to know which project
 * the run belongs to before deciding whether to serve it.
 */
export async function getRunWorkflowId(runId: string): Promise<number | null> {
  const config = getGithubConfig();
  if (!config.configured) return null;
  const res = await githubFetch(`/repos/${config.owner}/${config.repo}/actions/runs/${runId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.workflow_id === "number" ? data.workflow_id : null;
}
