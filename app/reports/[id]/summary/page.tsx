"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getTestDescription } from "@/lib/testDescriptions";
import type { RunDetailResponse, TestCaseResult, TestReportResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** "tests/export/analytics.spec.ts" -> "Export · Analytics" — no file extensions or "tests/" noise. */
function friendlyGroupName(file: string): string {
  const parts = file
    .replace(/\.(spec|test)\.[jt]sx?$/, "")
    .split("/")
    .filter((p) => p && p !== "tests");
  return parts
    .map((p) => p.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");
}

function StatBlock({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-4 text-center">
      <p
        className={`text-3xl font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function ResultRow({ test, locale }: { test: TestCaseResult; locale: "en" | "uz" | "ru" }) {
  const { t } = useI18n();
  const description = getTestDescription(test.file, test.line, locale) ?? test.titlePath.join(" › ");
  const isPass = test.status === "passed" || test.status === "flaky";
  const isSkipped = test.status === "skipped";

  const badge = isSkipped
    ? { emoji: "⏭️", label: t("status.skipped"), className: "bg-gray-500/15 text-gray-400" }
    : isPass
      ? { emoji: "✅", label: t("status.passed"), className: "bg-emerald-500/15 text-emerald-300" }
      : { emoji: "❌", label: t("status.failed"), className: "bg-red-500/15 text-red-300" };

  return (
    <div className="flex items-start gap-3 border-b border-surface-border px-4 py-3 last:border-0">
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.emoji} {badge.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-100">{description}</p>
        {test.status === "flaky" && (
          <p className="mt-0.5 text-xs text-amber-400">{t("resultsSummary.passedAfterRetry")}</p>
        )}
        {test.error && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
              {t("resultsSummary.whatWentWrong")}
            </summary>
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-md bg-red-500/5 px-3 py-2 font-mono text-xs leading-relaxed text-red-300">
              {test.error}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function RunSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();

  const { data: runData } = useSWR<RunDetailResponse>(`/api/runs/${id}`, fetcher);
  const { data: testsData, isLoading } = useSWR<TestReportResponse>(`/api/runs/${id}/tests`, fetcher);

  const run = runData?.run;
  const tests = testsData?.tests ?? [];
  const summary = testsData?.summary;

  const groups = useMemo(() => {
    const byFile = new Map<string, TestCaseResult[]>();
    for (const test of tests) {
      if (!byFile.has(test.file)) byFile.set(test.file, []);
      byFile.get(test.file)!.push(test);
    }
    return [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tests]);

  const hasData = Boolean(testsData?.available) && tests.length > 0;
  const allPassed = hasData && summary!.failed === 0;
  const hasFailures = hasData && summary!.failed > 0;
  const stillRunning = run && run.status !== "completed";

  const banner = stillRunning
    ? { emoji: "⏳", text: t("resultsSummary.inProgress"), className: "border-blue-500/30 bg-blue-500/10" }
    : !hasData
      ? { emoji: "ℹ️", text: t("resultsSummary.noData"), className: "border-surface-border bg-surface-panel" }
      : allPassed
        ? { emoji: "✅", text: t("resultsSummary.allPassed"), className: "border-emerald-500/30 bg-emerald-500/10" }
        : { emoji: "❌", text: t("resultsSummary.someFailed"), className: "border-red-500/30 bg-red-500/10" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/reports/${id}`} className="text-xs text-gray-500 hover:text-gray-300">
        ← {t("resultsSummary.backToDetails")}
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">
          {run?.name ?? `#${id}`} {run && <span className="text-gray-500">#{run.runNumber}</span>}
        </h1>
        {run && (
          <p className="mt-1 text-sm text-gray-500">
            {formatRelativeTime(run.createdAt)} · {formatDateTime(run.createdAt)}
          </p>
        )}
      </div>

      <div className={`rounded-xl border p-6 text-center ${banner.className}`}>
        <div className="text-4xl">{banner.emoji}</div>
        <p className="mt-2 text-lg font-medium text-white">{banner.text}</p>
      </div>

      {hasData && (
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label={t("resultsSummary.total")} value={summary!.total} />
          <StatBlock label={t("status.passed")} value={summary!.passed} tone="good" />
          <StatBlock label={t("status.failed")} value={summary!.failed} tone="bad" />
        </div>
      )}

      {isLoading && !testsData ? (
        <p className="text-center text-sm text-gray-500">…</p>
      ) : !hasData ? (
        !stillRunning && (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            {t("resultsSummary.empty")}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {groups.map(([file, fileTests]) => (
            <div key={file} className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
              <div className="border-b border-surface-border bg-surface-hover/40 px-4 py-2.5">
                <span className="text-sm font-medium text-gray-300">{friendlyGroupName(file)}</span>
              </div>
              <div>
                {fileTests.map((test, i) => (
                  <ResultRow key={`${test.file}:${test.titlePath.join("/")}:${i}`} test={test} locale={locale} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
