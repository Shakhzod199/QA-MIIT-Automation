"use client";

import { useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NotifyStatus {
  telegramConfigured: boolean;
  githubConfigured: boolean;
  chatHint: string | null;
  cronSecretSet: boolean;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
          : "bg-red-500/15 text-red-300 ring-red-500/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

export default function AlertsPage() {
  const { t } = useI18n();
  const { data: status, mutate } = useSWR<NotifyStatus>("/api/notify/status", fetcher);
  const [busy, setBusy] = useState<null | "test" | "check">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const ready = status?.telegramConfigured && status?.githubConfigured;

  const sendTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const res = await fetch("/api/notify/test", { method: "POST" });
      const data = await res.json();
      setMessage(
        data.ok
          ? { ok: true, text: "Test message sent — check your Telegram." }
          : { ok: false, text: data.error ?? "Failed to send test message." }
      );
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async () => {
    setBusy("check");
    setMessage(null);
    try {
      const res = await fetch("/api/notify", { method: "POST" });
      const data = await res.json();
      if (!data.ok && data.error) {
        setMessage({ ok: false, text: data.error });
      } else if (data.seeded) {
        setMessage({ ok: true, text: `Baseline recorded for ${data.baselined} existing runs. New results from now on will alert.` });
      } else {
        setMessage({ ok: true, text: `Checked ${data.checked} runs · sent ${data.sent} alert${data.sent !== 1 ? "s" : ""}.` });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">{t("alerts.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t("alerts.subtitle")}</p>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill ok={Boolean(status?.telegramConfigured)} label="Telegram" />
          <StatusPill ok={Boolean(status?.githubConfigured)} label="GitHub" />
          {status?.chatHint && (
            <span className="text-xs text-gray-500">chat {status.chatHint}</span>
          )}
          {status && !status.cronSecretSet && (
            <span className="ml-auto text-xs text-amber-400">NOTIFY_SECRET not set (needed for cron)</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={sendTest}
            disabled={!ready || busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "test" ? "…" : t("alerts.sendTest")}
          </button>
          <button
            onClick={checkNow}
            disabled={!ready || busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-hover px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "check" ? "…" : t("alerts.checkNow")}
          </button>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:text-gray-300"
          >
            {t("alerts.refresh")}
          </button>
        </div>

        {message && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              message.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Setup guide */}
      <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
        <h3 className="text-sm font-medium text-gray-200">Setup</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-400">
          <li>
            Create a bot with <a className="text-indigo-400 hover:text-indigo-300" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> and copy its token.
          </li>
          <li>
            Send your bot a message, then get your chat id from{" "}
            <code className="text-gray-300">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>.
          </li>
          <li>
            Add to <code className="text-gray-300">.env.local</code> and restart:
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-hover px-3 py-2 font-mono text-xs text-gray-300">{`TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
NOTIFY_SECRET=some-random-string`}</pre>
          </li>
          <li>Click <span className="text-gray-300">Send test message</span> above to confirm.</li>
        </ol>

        <h3 className="mt-5 text-sm font-medium text-gray-200">Automatic per-run alerts</h3>
        <p className="mt-2 text-sm text-gray-400">
          Each test workflow sends its own Telegram message the moment a run finishes (passed,
          failed, or cancelled) — no hosting or polling required. Add these two{" "}
          <a
            className="text-indigo-400 hover:text-indigo-300"
            href="https://github.com/Shakhzod199/QA-MIIT-Automation/settings/secrets/actions"
            target="_blank"
            rel="noreferrer"
          >
            GitHub Actions repo secrets
          </a>{" "}
          so the workflow can reach your bot:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-surface-hover px-3 py-2 font-mono text-xs text-gray-300">{`TELEGRAM_BOT_TOKEN   (same bot token)
TELEGRAM_CHAT_ID     (same chat id)`}</pre>
        <p className="mt-2 text-sm text-gray-400">
          The <code className="text-gray-300">Check for new results now</code> button above is an
          optional fallback for when the dashboard itself is hosted and reachable.
        </p>
      </div>
    </div>
  );
}
