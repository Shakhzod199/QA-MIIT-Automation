import { NextResponse } from "next/server";
import { getGithubConfig, githubFetch } from "@/lib/github";
import { mapRun } from "@/lib/mappers";
import { isAuthorized } from "@/lib/notify-auth";
import { loadState, saveState } from "@/lib/notify-state";
import { formatRunMessage, isTelegramConfigured, sendTelegram } from "@/lib/telegram";
import type { RunSummary } from "@/lib/types";

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getGithubConfig();
  if (!config.configured) {
    return NextResponse.json({ ok: false, error: "GitHub is not configured." }, { status: 400 });
  }
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Telegram is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)." },
      { status: 400 }
    );
  }

  const runsRes = await githubFetch(
    `/repos/${config.owner}/${config.repo}/actions/runs?per_page=30`
  );
  if (!runsRes.ok) {
    return NextResponse.json(
      { ok: false, error: `GitHub API error: ${runsRes.status} ${runsRes.statusText}` },
      { status: 502 }
    );
  }

  const data = await runsRes.json();
  const completed: RunSummary[] = (data.workflow_runs ?? [])
    .map(mapRun)
    .filter((r: RunSummary) => r.status === "completed");

  const state = await loadState();

  // First run: record a baseline so we don't blast alerts for every historic
  // run. Only runs that complete AFTER this point will be alerted on.
  if (!state.seeded) {
    await saveState({ seeded: true, notified: completed.map((r) => r.id) });
    return NextResponse.json({ ok: true, seeded: true, baselined: completed.length, sent: 0 });
  }

  const notifiedSet = new Set(state.notified);
  // Send oldest → newest so messages arrive in chronological order.
  const fresh = completed
    .filter((r) => !notifiedSet.has(r.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sentIds: number[] = [];
  const errors: string[] = [];
  for (const run of fresh) {
    const result = await sendTelegram(formatRunMessage(run));
    if (result.ok) sentIds.push(run.id);
    else errors.push(`#${run.runNumber}: ${result.error}`);
  }

  await saveState({ seeded: true, notified: [...state.notified, ...sentIds] });

  return NextResponse.json({
    ok: errors.length === 0,
    checked: completed.length,
    sent: sentIds.length,
    errors,
  });
}

// Support GET (simple cron/curl) and POST (in-app button) alike.
export const GET = handle;
export const POST = handle;
