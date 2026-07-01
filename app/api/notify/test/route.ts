import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/notify-auth";
import { isTelegramConfigured, sendTelegram } from "@/lib/telegram";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Telegram is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)." },
      { status: 400 }
    );
  }

  const result = await sendTelegram(
    "✅ <b>QA Dashboard</b>\nTelegram alerts are connected. You'll get a message for every run result."
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
