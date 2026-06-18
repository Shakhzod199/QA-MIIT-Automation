import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import type { TriggerResponse } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = getGithubConfig();

  if (!config.configured) {
    return NextResponse.json<TriggerResponse>(
      { ok: false, error: "GitHub is not configured (missing token/owner/repo)." },
      { status: 400 }
    );
  }

  const { id } = await params;

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
