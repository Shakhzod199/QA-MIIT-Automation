"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { useCurrentUser } from "@/components/UserProvider";
import { StatCard, StatsCards } from "@/components/StatsCards";
import { RunsTable } from "@/components/RunsTable";
import { TypeTabs } from "@/components/TypeTabs";
import { SuiteTestCaseList } from "@/components/SuiteTestCaseList";
import { computeStats } from "@/lib/stats";
import { getSuiteDisabledReason } from "@/lib/disabledSuites";
import { hasRole } from "@/lib/permissions";
import { formatDuration, getStatusBadge } from "@/lib/format";
import type {
  RunsResponse,
  TestReportResponse,
  TriggerResponse,
  WorkflowsResponse,
} from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SuiteTestsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <SuiteTestsPageInner params={params} />
    </Suspense>
  );
}

function SuiteTestsPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const workflowId = Number(id);
  const searchParams = useSearchParams();
  const type = (searchParams.get("type") as "frontend" | "api" | "load" | null) ?? "frontend";

  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher);
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher);

  const workflow = workflowsData?.workflows.find((w) => w.id === workflowId);
  const currentUser = useCurrentUser();
  const canTrigger = !currentUser || hasRole(currentUser.role, "editor");
  const disabledReason = getSuiteDisabledReason(workflow?.name) ?? (canTrigger ? null : t("suite.viewerReadOnly"));

  // This page's runs, stats, and card are scoped to just this workflow + type
  // (unlike the home dashboard, which mixes every project/type together).
  const scopedRuns = useMemo(
    () => (runsData?.runs ?? []).filter((r) => r.workflowId === workflowId && r.runType === type),
    [runsData, workflowId, type]
  );
  const scopedStats = useMemo(() => computeStats(scopedRuns), [scopedRuns]);

  const handleCancel = async (runId: number): Promise<TriggerResponse> => {
    const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
    const result: TriggerResponse = await res.json();
    if (result.ok) {
      setTimeout(() => mutateRuns(), 1500);
    }
    return result;
  };

  // Newest *full-suite* run for this workflow that produced a report artifact.
  // - success/failure only: those upload a report (via `if: always()`);
  //   cancelled/skipped runs have no results.json.
  // - !testFilter: single-test runs only contain the one test they ran, so they
  //   can't be the source of the full catalog — skip them here.
  const latestRunId = useMemo(() => {
    const runs = runsData?.runs ?? [];
    return runs.find(
      (r) =>
        r.workflowId === workflowId &&
        r.runType === type &&
        r.status === "completed" &&
        (r.conclusion === "success" || r.conclusion === "failure") &&
        !r.testFilter
    )?.id;
  }, [runsData, workflowId, type]);

  const { data: testsData } = useSWR<TestReportResponse>(
    latestRunId ? `/api/runs/${latestRunId}/tests` : null,
    fetcher
  );

  // ── Backend (api/load) ──────────────────────────────────────────────────
  // No per-test selection: api runs are dispatched as a single unit via the
  // workflow's "type" input. load (K6) additionally offers a per-kind
  // button (Load/Stress/...) by passing that kind as `test_filter` — the
  // same input frontend/api use for a single-test filter, repurposed here
  // (workflow-side) as "which k6 script to run". Empty = run every kind,
  // same "no filter = whole suite" convention test_filter has elsewhere.
  const [typeRunState, setTypeRunState] = useState<"idle" | "pending" | "triggered">("idle");
  const [typeRunError, setTypeRunError] = useState<string | null>(null);
  // Which k6 kind ("", "load", "stress", ...) is mid-flight, so only that
  // button shows a spinner while the others stay clickable... except we
  // disable all of them together below to avoid piling up concurrent runs
  // against the same live API.
  const [pendingKind, setPendingKind] = useState<string | null>(null);

  const handleRunType = async (kind = "") => {
    if (typeRunState === "pending" || disabledReason) return;
    setTypeRunState("pending");
    setPendingKind(kind);
    setTypeRunError(null);

    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowId,
        inputs: kind ? { type, test_filter: kind } : { type },
      }),
    });
    const result: TriggerResponse = await res.json();

    if (result.ok) {
      setTypeRunState("triggered");
      setTimeout(() => {
        setTypeRunState("idle");
        setPendingKind(null);
      }, 4000);
    } else {
      setTypeRunState("idle");
      setPendingKind(null);
      setTypeRunError(result.error ?? "Failed to trigger run");
    }
  };

  // Extend this list when spike/smoke scripts exist — each entry is just a
  // test_filter value plus a label, nothing else needs to change.
  const K6_KINDS = [
    { value: "", label: t("suiteTests.runAll") },
    { value: "load", label: t("suiteTests.runLoad") },
    { value: "stress", label: t("suiteTests.runStress") },
  ];

  if (type !== "frontend") {
    // API tests have a real per-test catalog (the report's test list), so
    // show counts of how many API tests exist/passed/failed instead of the
    // run-level stats below. K6 (load) has no such catalog — it only ever
    // produces threshold pass/fail, already shown per-run in the table — so
    // it keeps the original run-based cards.
    const apiSummary = testsData?.summary;

    // K6 has no per-test catalog (just thresholds), so its cards stay
    // run-level — but reframed around what actually matters for a load
    // test: how long it takes and what happened most recently, rather than
    // a generic "Last Run" timestamp.
    const latestRun = scopedRuns[0];
    const completedDurations = scopedRuns
      .filter((r) => r.status === "completed" && r.durationSec != null)
      .map((r) => r.durationSec as number);
    const avgDurationSec =
      completedDurations.length > 0
        ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
        : null;
    const latestBadge = latestRun ? getStatusBadge(latestRun.status, latestRun.conclusion) : null;

    return (
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[11px] text-q-dim">
            <Link href="/" className="hover:text-q-sub transition">Test Cases</Link>
            {" / "}{workflow?.name ?? `Suite #${workflowId}`}
          </p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[21px] font-semibold tracking-[-0.5px] text-q-text">
                {workflow?.name ?? `Suite #${workflowId}`}
              </h2>
              {workflow?.state === "active" && (
                <span className="flex items-center gap-1.5 rounded-[20px] px-[10px] py-1 text-[11px] font-semibold" style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-q-green" />
                  workflow active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {workflow && (
                <a href={workflow.htmlUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-q-muted hover:text-q-sub transition">
                  View on GitHub ↗
                </a>
              )}
            </div>
          </div>
        </div>

        <TypeTabs workflowId={workflowId} active={type} />

        {type === "api" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={t("suiteTests.totalApis")} value={String(apiSummary?.total ?? 0)} />
            <StatCard
              label={t("suiteTests.apisPassed")}
              value={String(apiSummary?.passed ?? 0)}
              sub={apiSummary?.total ? `${Math.round((apiSummary.passed / apiSummary.total) * 100)}%` : undefined}
            />
            <StatCard
              label={t("suiteTests.apisFailed")}
              value={String(apiSummary?.failed ?? 0)}
              sub={apiSummary?.total ? `${Math.round((apiSummary.failed / apiSummary.total) * 100)}%` : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("suiteTests.totalRuns")} value={String(scopedStats.total)} />
            <StatCard
              label={t("suiteTests.thresholdPassRate")}
              value={`${scopedStats.passRate}%`}
              sub={t("suiteTests.thresholdPassRateSub")}
            />
            <StatCard
              label={t("suiteTests.avgDuration")}
              value={avgDurationSec != null ? formatDuration(avgDurationSec) : "—"}
            />
            {latestRun && latestBadge ? (
              <Link href={`/reports/${latestRun.id}`} className="block">
                <StatCard
                  label={t("suiteTests.latestResult")}
                  value={latestBadge.label}
                  sub={t("table.viewK6Report")}
                  interactive
                />
              </Link>
            ) : (
              <StatCard label={t("suiteTests.latestResult")} value="—" />
            )}
          </div>
        )}

        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              {workflow && workflow.state !== "active" && (
                <p className="text-[12px] text-q-amber">workflow is {workflow.state}</p>
              )}
              {disabledReason && <p className="text-[12px] text-q-amber">{disabledReason}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(type === "load" ? K6_KINDS : [{ value: "", label: t("suiteTests.run") }]).map((kind) => {
                const isThisPending = typeRunState === "pending" && pendingKind === kind.value;
                const isThisTriggered = typeRunState === "triggered" && pendingKind === kind.value;
                return (
                  <button
                    key={kind.value}
                    onClick={() => handleRunType(kind.value)}
                    disabled={typeRunState === "pending" || !!disabledReason}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      isThisTriggered
                        ? { background: "rgba(61,220,151,0.2)", color: "#3ddc97" }
                        : { background: "#3ddc97", color: "#06140d" }
                    }
                  >
                    {isThisPending && (
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {isThisTriggered ? t("suiteTests.triggered") : kind.label}
                  </button>
                );
              })}
            </div>
          </div>
          {typeRunError && <p className="mt-2 text-[12px] text-q-red">{typeRunError}</p>}
        </div>

        <div>
          <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
          <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={canTrigger ? handleCancel : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] text-q-dim">
          <Link href="/" className="hover:text-q-sub transition">Test Cases</Link>
          {" / "}{workflow?.name ?? `Suite #${workflowId}`}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[21px] font-semibold tracking-[-0.5px] text-q-text">
              {workflow?.name ?? `Suite #${workflowId}`}
            </h2>
            {workflow?.state === "active" && (
              <span className="flex items-center gap-1.5 rounded-[20px] px-[10px] py-1 text-[11px] font-semibold" style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-q-green" />
                workflow active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {workflow && (
              <a href={workflow.htmlUrl} target="_blank" rel="noreferrer" className="text-[12.5px] text-q-muted hover:text-q-sub transition">
                View on GitHub ↗
              </a>
            )}
            {disabledReason && (
              <p className="text-[12px] text-q-amber">{disabledReason}</p>
            )}
          </div>
        </div>
      </div>

      <TypeTabs workflowId={workflowId} active={type} />

      {testsData?.available ? (
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total tests" value={String(testsData.summary.total)} />
          <StatCard label="Passed" value={String(testsData.summary.passed)} valueColor="#3ddc97" />
          <StatCard label="Failed" value={String(testsData.summary.failed)} valueColor={testsData.summary.failed > 0 ? "#ff5d5d" : undefined} />
          <StatCard label="Flaky" value={String(testsData.summary.flaky)} valueColor={testsData.summary.flaky > 0 ? "#f5b544" : undefined} />
        </div>
      ) : (
        <StatsCards stats={scopedStats} />
      )}

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("dashboard.recentRuns")}</h3>
        <RunsTable runs={scopedRuns} hideProject pageSize={5} onCancel={canTrigger ? handleCancel : undefined} />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">{t("suiteTests.testCases")}</h3>
        <SuiteTestCaseList workflowId={workflowId} workflowName={workflow?.name} />
      </div>
    </div>
  );
}
