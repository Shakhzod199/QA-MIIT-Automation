import { NextResponse } from "next/server";
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

  const res = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: ref ?? "main",
        ...(inputs && Object.keys(inputs).length > 0 ? { inputs } : {}),
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
