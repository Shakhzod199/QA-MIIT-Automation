import { NextResponse } from "next/server";
import { getGithubConfig } from "@/lib/github";
import { isAuthorized } from "@/lib/notify-auth";
import { isTelegramConfigured, telegramChatHint } from "@/lib/telegram";

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    telegramConfigured: isTelegramConfigured(),
    githubConfigured: getGithubConfig().configured,
    chatHint: telegramChatHint(),
    cronSecretSet: Boolean(process.env.NOTIFY_SECRET),
  });
}
