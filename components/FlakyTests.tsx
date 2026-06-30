import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { FlakyTest, TestStatus } from "@/lib/types";

const HISTORY_COLOR: Record<TestStatus, string> = {
  passed: "bg-[#3ddc97]",
  failed: "bg-[#ff5d5d]",
  timedOut: "bg-[#ff5d5d]",
  flaky: "bg-[#f5b544]",
  skipped: "bg-[#5b636e]",
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
    <div className="flex items-center gap-2" title={`Flake rate: ${pct}% of runs for this test were flaky`}>
      <div className="h-[5px] w-16 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full bg-[#f5b544]" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-medium tabular-nums text-[#f5b544]">
        {pct}%
      </span>
    </div>
  );
}

function FlakyRow({ test }: { test: FlakyTest }) {
  const title = test.titlePath.join(" › ");
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-q-text">{title}</p>
        <p className="mt-0.5 flex items-center gap-2 truncate font-mono text-[11px] text-q-dim">
          <span className="truncate">{test.file}</span>
          {test.project && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-q-muted" style={{ background: "rgba(255,255,255,0.06)" }}>
              {test.project}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
        <span title={`${test.passed} passed`} className="rounded px-1.5 py-0.5 text-[#3ddc97]" style={{ background: "rgba(61,220,151,0.12)" }}>
          {test.passed}P
        </span>
        <span title={`${test.failed} failed`} className="rounded px-1.5 py-0.5 text-[#ff5d5d]" style={{ background: "rgba(255,93,93,0.12)" }}>
          {test.failed}F
        </span>
        {test.flaky > 0 && (
          <span title={`${test.flaky} flaky`} className="rounded px-1.5 py-0.5 text-[#f5b544]" style={{ background: "rgba(245,181,68,0.12)" }}>
            {test.flaky}~
          </span>
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
  const { t } = useI18n();
  if (tests.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border p-8 text-center" style={{ background: "rgba(61,220,151,0.04)" }}>
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-[13px] font-medium text-q-text">{t("flaky.none")}</p>
        <p className="mt-1 text-[12px] text-q-muted">{t("flaky.noneHint")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel">
      <div className="border-b border-surface-border px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-q-dim">
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
