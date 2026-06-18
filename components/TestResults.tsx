"use client";

import { useMemo, useState } from "react";
import type { TestCaseResult, TestReportSummary, TestStatus } from "@/lib/types";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

const STATUS_META: Record<TestStatus, { label: string; dot: string; text: string; mark: string }> = {
  passed: { label: "Passed", dot: "bg-emerald-500", text: "text-emerald-300", mark: "✓" },
  failed: { label: "Failed", dot: "bg-red-500", text: "text-red-300", mark: "✕" },
  timedOut: { label: "Timed out", dot: "bg-red-500", text: "text-red-300", mark: "⧖" },
  flaky: { label: "Flaky", dot: "bg-amber-500", text: "text-amber-300", mark: "~" },
  skipped: { label: "Skipped", dot: "bg-gray-500", text: "text-gray-400", mark: "–" },
};

function SummaryChip({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-panel px-3 py-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function TestRow({ test }: { test: TestCaseResult }) {
  const meta = STATUS_META[test.status];
  const title = test.titlePath.join(" › ");
  const hasError = Boolean(test.error);

  const head = (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${meta.dot}`}
      >
        {meta.mark}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{title}</span>
      {test.retries > 0 && (
        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
          {test.retries} retr{test.retries === 1 ? "y" : "ies"}
        </span>
      )}
      {test.project && (
        <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-gray-400">
          {test.project}
        </span>
      )}
      <span className="shrink-0 tabular-nums text-xs text-gray-500">{formatMs(test.durationMs)}</span>
    </div>
  );

  if (!hasError) {
    return <div className="border-b border-surface-border last:border-0">{head}</div>;
  }

  return (
    <details className="group border-b border-surface-border last:border-0">
      <summary className="cursor-pointer list-none hover:bg-surface-hover">
        <div className="flex items-center">
          <div className="min-w-0 flex-1">{head}</div>
          <svg
            className="mr-4 h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </summary>
      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-surface-border bg-red-500/5 px-4 py-3 font-mono text-xs leading-relaxed text-red-300">
        {test.error}
      </pre>
    </details>
  );
}

type Filter = "all" | "failed" | "flaky";
type Sort = "file" | "slowest";

export function TestResults({
  summary,
  tests,
}: {
  summary: TestReportSummary;
  tests: TestCaseResult[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("file");

  const filtered = useMemo(() => {
    if (filter === "failed") return tests.filter((t) => t.status === "failed" || t.status === "timedOut");
    if (filter === "flaky") return tests.filter((t) => t.status === "flaky");
    return tests;
  }, [tests, filter]);

  // Group by file (default), or present a flat slowest-first list.
  const groups = useMemo(() => {
    if (sort === "slowest") {
      const flat = [...filtered].sort((a, b) => b.durationMs - a.durationMs);
      return [{ file: "Slowest first", tests: flat }];
    }
    const byFile = new Map<string, TestCaseResult[]>();
    for (const t of filtered) {
      const key = t.file || "(unknown file)";
      if (!byFile.has(key)) byFile.set(key, []);
      byFile.get(key)!.push(t);
    }
    return [...byFile.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([file, list]) => ({ file, tests: list }));
  }, [filtered, sort]);

  const FilterButton = ({ value, label, count }: { value: Filter; label: string; count: number }) => (
    <button
      onClick={() => setFilter(value)}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        filter === value
          ? "bg-surface-hover text-white ring-1 ring-inset ring-surface-border"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label} <span className="tabular-nums text-gray-500">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SummaryChip label="Passed" value={summary.passed} dot="bg-emerald-500" />
        <SummaryChip label="Failed" value={summary.failed} dot="bg-red-500" />
        <SummaryChip label="Flaky" value={summary.flaky} dot="bg-amber-500" />
        <SummaryChip label="Skipped" value={summary.skipped} dot="bg-gray-500" />
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-panel px-3 py-2 text-xs text-gray-400">
          <svg className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatMs(summary.durationMs)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <FilterButton value="all" label="All" count={summary.total} />
          <FilterButton value="failed" label="Failed" count={summary.failed} />
          <FilterButton value="flaky" label="Flaky" count={summary.flaky} />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-500">Sort:</span>
          <button
            onClick={() => setSort("file")}
            className={`rounded px-2 py-1 transition ${sort === "file" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            By file
          </button>
          <button
            onClick={() => setSort("slowest")}
            className={`rounded px-2 py-1 transition ${sort === "slowest" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Slowest
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-panel p-6 text-center text-sm text-gray-500">
          No tests match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.file} className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
              <div className="flex items-center justify-between border-b border-surface-border bg-surface-hover/40 px-4 py-2">
                <span className="truncate font-mono text-xs text-gray-400">{group.file}</span>
                <span className="shrink-0 text-xs text-gray-500">{group.tests.length}</span>
              </div>
              <div>
                {group.tests.map((test, i) => (
                  <TestRow key={`${test.file}:${test.titlePath.join("/")}:${test.project}:${i}`} test={test} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
