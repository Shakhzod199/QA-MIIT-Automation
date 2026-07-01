"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { SuiteTestCaseList } from "@/components/SuiteTestCaseList";
import { suiteBreakdown } from "@/lib/trends";
import { formatRelativeTime } from "@/lib/format";
import type { RunSummary } from "@/lib/types";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-q-dim transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * One collapsible card per suite, each expanding into the full Playwright
 * test-case list + run controls (SuiteTestCaseList — the same component
 * app/suites/[id]/page.tsx uses, so behavior is identical everywhere).
 */
export function SuiteTestCasesSection({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n();
  const suites = useMemo(() => suiteBreakdown(runs), [runs]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (workflowId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workflowId)) next.delete(workflowId);
      else next.add(workflowId);
      return next;
    });

  if (suites.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
        {t("dashboard.noWorkflows")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suites.map((s) => {
        const isOpen = expanded.has(s.workflowId);
        return (
          <div key={s.workflowId} className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel">
            <button
              type="button"
              onClick={() => toggle(s.workflowId)}
              className="flex w-full items-center justify-between gap-4 px-[18px] py-[14px] text-left transition hover:bg-surface-hover"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ChevronIcon open={isOpen} />
                <span className="truncate text-[14px] font-semibold text-q-text">{s.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span
                  className="rounded-[6px] px-2 py-0.5 font-mono text-[11px] font-semibold"
                  style={
                    s.passRate >= 80
                      ? { background: "rgba(61,220,151,0.14)", color: "#3ddc97" }
                      : s.passRate >= 50
                        ? { background: "rgba(245,181,68,0.14)", color: "#f5b544" }
                        : { background: "rgba(255,93,93,0.14)", color: "#ff5d5d" }
                  }
                >
                  {s.passRate}%
                </span>
                <span className="hidden font-mono text-[12px] text-q-dim sm:inline">
                  {s.total} {t("trends.runs")}
                </span>
                <span className="hidden text-[12px] text-q-dim md:inline">{formatRelativeTime(s.lastRunAt)}</span>
                <Link
                  href={`/suites/${s.workflowId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[12px] font-medium text-q-green transition hover:opacity-80"
                >
                  {t("dashboard.viewFullSuite")} →
                </Link>
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-surface-border p-[18px]">
                <SuiteTestCaseList workflowId={s.workflowId} workflowName={s.name} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
