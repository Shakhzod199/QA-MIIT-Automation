import { formatDuration, formatRelativeTime } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Masked chat id for display on the settings page (never expose the token). */
export function telegramChatHint(): string | null {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) return null;
  return id.length <= 4 ? id : `…${id.slice(-4)}`;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendTelegram(html: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "Telegram is not configured." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram API ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function emojiFor(conclusion: string | null): string {
  switch (conclusion) {
    case "success":
      return "✅";
    case "failure":
      return "❌";
    case "cancelled":
      return "⚠️";
    case "timed_out":
      return "⏰";
    default:
      return "ℹ️";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Builds the per-run alert message. Sent for ALL conclusions, not just failures. */
export function formatRunMessage(run: RunSummary): string {
  const emoji = emojiFor(run.conclusion);
  const label = (run.conclusion ?? "completed").replace(/_/g, " ");
  const lines = [
    `${emoji} <b>${escapeHtml(run.name)}</b> #${run.runNumber}`,
    `Result: <b>${escapeHtml(label)}</b>`,
    `Branch: <code>${escapeHtml(run.branch ?? "—")}</code>`,
    `Duration: ${formatDuration(run.durationSec)} · ${formatRelativeTime(run.createdAt)}`,
    run.htmlUrl,
  ];
  return lines.join("\n");
}
