import { NextResponse } from "next/server";
import { canAccessWorkflow } from "@/lib/access";
import { getGithubConfig, githubFetch } from "@/lib/github";
import type { TriggerResponse } from "@/lib/types";

export async function POST(request: Request) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "GitHub is not configured (missing token/owner/repo)." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { workflowId, ref, inputs } = body as {
    workflowId?: number;
    ref?: string;
    // Forwarded verbatim as workflow_dispatch inputs (e.g. { test_filter }).
    inputs?: Record<string, string>;
  };

  if (!workflowId) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "Missing workflowId." },
      { status: 400 }
    );
  }

  // middleware.ts already gated this route to editor+; this adds the
  // per-project layer on top, so an editor can't trigger a suite outside
  // their assigned projects just by knowing/guessing its workflowId.
  if (!(await canAccessWorkflow(request, workflowId))) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "You don't have access to this project." },
      { status: 403 }
    );
  }

  // Stamp the dispatch with whoever's logged in, so the workflow's Telegram
  // notification can say who ran it instead of just "manual" vs "CI/CD".
  // Read straight off the header middleware.ts already forwards — no extra
  // DB lookup needed, and every call here is already behind a valid session.
  const username = request.headers.get("x-user-username");
  const mergedInputs: Record<string, string> = { ...(inputs ?? {}) };
  if (username) mergedInputs.dashboard_user = username;

  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: ref ?? "main",
        ...(Object.keys(mergedInputs).length > 0 ? { inputs: mergedInputs } : {}),
      }),
    }
  );

  if (res.status === 204) {
    return NextResponse.json<TriggerResponse>({ ok: true });
  }

  const text = await res.text().catch(() => "");
  return NextResponse.json<TriggerResponse>(
    { ok: false, error: `GitHub API error: ${res.status} ${text}` },
    { status: 502 }
  );
}
