"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { useI18n } from "@/components/I18nProvider";
import { useCurrentUser } from "@/components/UserProvider";
import { SuiteTestCaseList } from "@/components/SuiteTestCaseList";
import { TriggerSourceBadge } from "@/components/TriggerSourceBadge";
import { getSuiteDisabledReason } from "@/lib/disabledSuites";
import { hasRole } from "@/lib/permissions";
import { suiteBreakdown } from "@/lib/trends";
import { formatRelativeTime } from "@/lib/format";
import type { RunSummary, TriggerResponse } from "@/lib/types";

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
  const { mutate } = useSWRConfig();
  const suites = useMemo(() => suiteBreakdown(runs), [runs]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Per-suite trigger state for the header's "Run" button (runs the whole
  // suite, no test filter — same as an empty selection on the expanded list).
  const [runState, setRunState] = useState<Record<number, "idle" | "pending" | "triggered">>({});

  const currentUser = useCurrentUser();
  const canTrigger = !currentUser || hasRole(currentUser.role, "editor");

  const toggle = (workflowId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workflowId)) next.delete(workflowId);
      else next.add(workflowId);
      return next;
    });

  const handleRunSuite = async (workflowId: number, workflowName: string) => {
    if (runState[workflowId] === "pending" || getSuiteDisabledReason(workflowName) || !canTrigger) return;
    setRunState((prev) => ({ ...prev, [workflowId]: "pending" }));

    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setRunState((prev) => ({ ...prev, [workflowId]: "triggered" }));
      setTimeout(() => mutate("/api/runs?per_page=50"), 1500);
      setTimeout(() => setRunState((prev) => ({ ...prev, [workflowId]: "idle" })), 4000);
    } else {
      setRunState((prev) => ({ ...prev, [workflowId]: "idle" }));
    }
  };

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
        const disabledReason = getSuiteDisabledReason(s.name) ?? (canTrigger ? null : t("suite.viewerReadOnly"));
        const state = runState[s.workflowId] ?? "idle";
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
                {/* How the suite's most recent run was started (Manual vs CI/CD). */}
                {s.lastTriggerSource && (
                  <TriggerSourceBadge source={s.lastTriggerSource} title={t("trends.lastRunTrigger")} />
                )}
                <span className="hidden font-mono text-[12px] text-q-dim sm:inline">
                  {s.total} {t("trends.runs")}
                </span>
                <span className="hidden text-[12px] text-q-dim md:inline">{formatRelativeTime(s.lastRunAt)}</span>
                <button
                  type="button"
                  title={disabledReason ?? undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunSuite(s.workflowId, s.name);
                  }}
                  disabled={state === "pending" || !!disabledReason}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-3 py-[5px] text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={
                    state === "triggered"
                      ? { background: "rgba(61,220,151,0.2)", color: "#3ddc97" }
                      : { background: "#3ddc97", color: "#06140d" }
                  }
                >
                  {state === "pending" && (
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {state === "triggered" ? t("suiteTests.triggered") : t("suiteTests.run")}
                </button>
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
