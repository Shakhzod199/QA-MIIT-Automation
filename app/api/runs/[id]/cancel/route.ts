import { NextResponse } from "next/server";
import { canAccessWorkflow, getRunWorkflowId } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import type { TriggerResponse } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "GitHub is not configured (missing token/owner/repo)." },
      { status: 400 }
    );
  }

  const { id } = await params;

  // Cancel is keyed by run id, not workflow id, so the project this run
  // belongs to has to be resolved first — same per-project gate as trigger.
  const workflowId = await getRunWorkflowId(id);
  if (workflowId != null && !(await canAccessWorkflow(request, workflowId))) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "You don't have access to this project." },
      { status: 403 }
    );
  }

  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs/${id}/cancel`,
    { method: "POST" }
  );

  // 202 Accepted = cancellation requested.
  if (res.status === 202) {
    return NextResponse.json<TriggerResponse>({ ok: true });
  }

  // 409 = run is already finished (nothing to cancel).
  if (res.status === 409) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "This run has already finished." },
      { status: 409 }
    );
  }

  const text = await res.text().catch(() => "");
  return NextResponse.json<TriggerResponse>(
    { ok: false, error: `GitHub API error: ${res.status} ${text}` },
    { status: 502 }
  );
}
