import Link from "next/link";
import type { FlakyTest, TestStatus } from "@/lib/types";

const HISTORY_COLOR: Record<TestStatus, string> = {
  passed: "bg-emerald-500",
  failed: "bg-red-500",
  timedOut: "bg-red-500",
  flaky: "bg-amber-500",
  skipped: "bg-gray-600",
};

function HistoryStrip({ test }: { test: FlakyTest }) {
  // Stored newest-first; render oldest→newest so the latest result sits at the right.
  const chronological = [...test.history].reverse();
  return (
    <div className="flex items-center gap-0.5">
      {chronological.map((h) => (
        <Link
          key={h.runId}
          href={`/reports/${h.runId}`}
          title={`#${h.runNumber} — ${h.status}`}
          className={`h-5 w-2 rounded-sm ${HISTORY_COLOR[h.status]} opacity-80 transition hover:opacity-100`}
        />
      ))}
    </div>
  );
}

function FlakeRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-border">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-amber-300">{pct}%</span>
    </div>
  );
}

function FlakyRow({ test }: { test: FlakyTest }) {
  const title = test.titlePath.join(" › ");
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-200">{title}</p>
        <p className="mt-0.5 flex items-center gap-2 truncate font-mono text-xs text-gray-500">
          <span className="truncate">{test.file}</span>
          {test.project && (
            <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-gray-400">
              {test.project}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">{test.passed}P</span>
        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">{test.failed}F</span>
        {test.flaky > 0 && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{test.flaky}~</span>
        )}
      </div>

      <div className="shrink-0">
        <HistoryStrip test={test} />
      </div>

      <div className="shrink-0">
        <FlakeRateBar rate={test.flakeRate} />
      </div>
    </div>
  );
}

export function FlakyTests({ tests }: { tests: FlakyTest[] }) {
  if (tests.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-sm font-medium text-gray-200">No flaky tests detected</p>
        <p className="mt-1 text-xs text-gray-500">
          Every test was consistent across the analyzed runs.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel">
      <div className="border-b border-surface-border px-4 py-2 text-[11px] uppercase tracking-wide text-gray-500">
        Test · outcomes (P/F/~) · run history (old → new) · flake rate
      </div>
      <div className="divide-y divide-surface-border">
        {tests.map((test) => (
          <FlakyRow key={test.key} test={test} />
        ))}
      </div>
    </div>
  );
}
