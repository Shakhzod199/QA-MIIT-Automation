"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { StatsCards } from "@/components/StatsCards";
import { RefreshButton } from "@/components/RefreshButton";
import { SuiteTestCasesSection } from "@/components/SuiteTestCasesSection";
import { useCurrentUser } from "@/components/UserProvider";
import { useI18n } from "@/components/I18nProvider";
import { hasRole } from "@/lib/permissions";
import { runsRefreshInterval } from "@/lib/runsPolling";
import { formatDuration, formatRelativeTime, getStatusBadge } from "@/lib/format";
import type { RunsResponse, RunSummary, WorkflowsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const EMPTY_STATS = {
  total: 0,
  passed: 0,
  failed: 0,
  completed: 0,
  passRate: 0,
  failRate: 0,
  lastRunAt: null,
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Compute daily pass-rate trend from runs (last 14 days)
function buildPassRateTrend(runs: RunSummary[]): number[] {
  const DAYS = 14;
  const now = Date.now();
  const buckets = Array.from({ length: DAYS }, () => ({ p: 0, t: 0 }));
  for (const r of runs) {
    if (r.status !== "completed") continue;
    const d = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000);
    const i = DAYS - 1 - d;
    if (i >= 0 && i < DAYS) {
      buckets[i].t++;
      if (r.conclusion === "success") buckets[i].p++;
    }
  }
  // Days without runs carry the previous day's rate. Seed with the first real
  // rate (not an invented constant) so leading empty days don't fabricate data.
  const firstWithRuns = buckets.find((b) => b.t > 0);
  let prev = firstWithRuns ? firstWithRuns.p / firstWithRuns.t : 1;
  return buckets.map((b) => {
    if (b.t > 0) prev = b.p / b.t;
    return prev;
  });
}

function buildSVGPath(rates: number[]): { line: string; area: string } {
  const W = 560;
  const H = 150;
  const n = rates.length;
  const pts = rates.map((r, i) => ({
    x: (i / (n - 1)) * W,
    y: H - r * H * 0.82 - 10,
  }));
  const coords = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
  return { line: `M${coords}`, area: `M${coords} L${W},${H} L0,${H} Z` };
}

function PassRateTrendChart({ runs }: { runs: RunSummary[] }) {
  const rates = useMemo(() => buildPassRateTrend(runs), [runs]);
  const { line, area } = useMemo(() => buildSVGPath(rates), [rates]);
  return (
    <svg
      viewBox="0 0 560 150"
      style={{ width: "100%", height: 150, display: "block", marginTop: 8 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3ddc97" stopOpacity="0.34" />
          <stop offset="1" stopColor="#3ddc97" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendGrad)" />
      <path
        d={line}
        fill="none"
        stroke="#3ddc97"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TodayByResult({ passed, failed, total }: { passed: number; failed: number; total: number }) {
  const other = Math.max(0, total - passed - failed);
  const max = Math.max(total, 1);
  const bar = (v: number) => `${Math.max(4, (v / max) * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-[13px]">
      {[
        { label: "Passed", value: passed, color: "#3ddc97", w: bar(passed) },
        { label: "Failed", value: failed, color: "#ff5d5d", w: bar(failed) },
        { label: "Other", value: other, color: "#5b636e", w: bar(other) },
      ].map(({ label, value, color, w }) => (
        <div key={label}>
          <div className="mb-[6px] flex justify-between font-medium text-[12px]">
            <span className="text-q-sub">{label}</span>
            <span className="font-mono" style={{ color }}>{value}</span>
          </div>
          <div className="h-[6px] rounded-[6px]" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-[6px] transition-all" style={{ width: w, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Status dot colors
function statusDotColor(run: RunSummary): string {
  if (run.status === "in_progress") return "#5b9dff";
  if (run.status === "queued") return "#5b636e";
  if (run.conclusion === "success") return "#3ddc97";
  if (run.conclusion === "failure") return "#ff5d5d";
  if (run.conclusion === "cancelled") return "#f5b544";
  return "#5b636e";
}

// Type badge (Playwright / API / K6 / Security)
const TYPE_BADGE: Record<RunSummary["runType"], { label: string; color: string; bg: string }> = {
  frontend: { label: "Playwright", color: "#8b5cf6", bg: "rgba(139,92,246,0.14)" },
  api: { label: "API", color: "#2dd4bf", bg: "rgba(45,212,191,0.14)" },
  load: { label: "K6", color: "#ff5fa2", bg: "rgba(255,95,162,0.14)" },
  security: { label: "Security", color: "#f5b544", bg: "rgba(245,181,68,0.14)" },
};

const TRIGGER_SOURCE_LABEL: Record<RunSummary["triggerSource"], string> = {
  manual: "Dashboard",
  "ci-cd": "CI/CD pipeline",
};

// Shared column template so the header row and run rows line up. Narrow
// screens keep Suite/Result/Started; sm adds Duration; lg shows everything.
const RUN_GRID =
  "grid items-center gap-3 grid-cols-[minmax(0,1fr)_78px_92px] sm:grid-cols-[minmax(0,1fr)_78px_64px_92px] lg:grid-cols-[minmax(0,1fr)_140px_92px_78px_64px_92px]";
// Visibility classes per column, matching the templates above.
const COL_VISIBILITY = ["", "hidden lg:block", "hidden lg:block", "", "hidden sm:block", ""];

// "19 minutes ago" wraps in a narrow column — compact the unit words.
function shortRelativeTime(iso: string): string {
  return formatRelativeTime(iso)
    .replace(" seconds", " sec")
    .replace(" minutes", " min")
    .replace(" minute", " min")
    .replace(" hours", " hr")
    .replace(" hour", " hr")
    .replace(" days", " d")
    .replace(" day", " d");
}

function RecentRunsHeader() {
  return (
    <div
      className={`${RUN_GRID} px-[18px] pb-2 pt-3`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {["Suite", "Triggered by", "Framework", "Result", "Duration", "Started"].map((label, i) => (
        <span
          key={label}
          className={`text-[10px] font-semibold uppercase tracking-[0.7px] text-q-dim ${
            i === 5 ? "text-right" : ""
          } ${COL_VISIBILITY[i]}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function RecentRunRow({ run }: { run: RunSummary }) {
  const dot = statusDotColor(run);
  const typeBadge = TYPE_BADGE[run.runType];
  const statusBadge = getStatusBadge(run.status, run.conclusion);
  const isLive = run.status === "in_progress" || run.status === "queued";

  return (
    <Link
      href={`/reports/${run.id}`}
      className={`${RUN_GRID} px-[18px] py-[13px] transition hover:bg-white/[0.02]`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Suite: dot + name, run # and branch below */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background: dot,
              ...(isLive ? { animation: "blip 1.2s infinite" } : {}),
            }}
          />
          <span className="truncate text-[13px] font-semibold text-q-text">{run.name}</span>
        </div>
        <div
          className="mt-0.5 truncate pl-4 font-mono text-[11px] text-q-dim"
          title={run.commitMessage ?? undefined}
        >
          Run #{run.runNumber}
          {run.branch ? ` · ${run.branch} branch` : ""}
          {run.commitMessage ? ` · “${run.commitMessage}”` : ""}
        </div>
        {run.testFilter && (
          <div className="mt-0.5 truncate pl-4 font-mono text-[11px] text-q-dim" title={run.testFilter}>
            Single test: {run.testFilter}
          </div>
        )}
      </div>

      {/* Triggered by */}
      <div className="hidden min-w-0 lg:block">
        <div className="truncate text-[12px] text-q-sub">{run.actor ?? "—"}</div>
        <div className="mt-0.5 truncate text-[11px] text-q-dim">
          via {TRIGGER_SOURCE_LABEL[run.triggerSource]}
        </div>
      </div>

      {/* Framework */}
      <span
        className="hidden w-fit rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold lg:block"
        style={{ color: typeBadge.color, background: typeBadge.bg }}
      >
        {typeBadge.label}
      </span>

      {/* Result */}
      <span
        className={`w-fit rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold ${statusBadge.className}`}
      >
        {statusBadge.label}
      </span>

      {/* Duration */}
      <span className="hidden font-mono text-[12px] text-q-muted sm:block">
        {formatDuration(run.durationSec)}
      </span>

      {/* Started */}
      <span className="whitespace-nowrap text-right text-[12px] text-q-dim" title={new Date(run.createdAt).toLocaleString()}>
        {shortRelativeTime(run.createdAt)}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { data: workflowsData, mutate: mutateWorkflows } = useSWR<WorkflowsResponse>(
    "/api/workflows",
    fetcher,
    { refreshInterval: 15000 }
  );
  // per_page=50 matches /suites/[id] and lib/trends.ts's suiteBreakdown usage
  // elsewhere, so SuiteTestCasesSection below has enough history per suite.
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>(
    "/api/runs?per_page=50",
    fetcher,
    { refreshInterval: runsRefreshInterval }
  );

  const handleRefresh = async () => {
    await Promise.all([mutateWorkflows(), mutateRuns()]);
  };

  const currentUser = useCurrentUser();
  const canTrigger = !currentUser || hasRole(currentUser.role, "editor");

  const configured = workflowsData?.configured ?? runsData?.configured ?? true;
  const runs = runsData?.runs ?? [];
  const stats = runsData?.stats ?? EMPTY_STATS;

  // Last 5 runs for the recent runs panel
  const recentRuns = useMemo(() => runs.slice(0, 5), [runs]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-5">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.4px] text-q-text">
            {getGreeting()}, {currentUser?.name || currentUser?.username || "QA Team"}
          </h2>
          <p className="mt-[3px] text-[12.5px] text-q-muted">
            miit.web · production · last run {formatRelativeTime(stats.lastRunAt).toLowerCase()}
          </p>
        </div>
        <RefreshButton
          onRefresh={handleRefresh}
          disabled={!canTrigger}
          title={canTrigger ? undefined : "You have read-only access and can't run tests."}
        />
      </div>

      {!configured && (
        <div className="rounded-[10px] border border-[rgba(245,181,68,0.3)] bg-[rgba(245,181,68,0.08)] p-4 text-[13px] text-[#f5b544]">
          GitHub is not configured yet. Add GITHUB_TOKEN and GITHUB_REPO to continue.
        </div>
      )}

      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Trend chart + Today by result */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[1.7fr_1fr]">
        {/* Pass rate trend */}
        <div className="rounded-[12px] border border-surface-border bg-surface-panel px-[18px] pb-2 pt-[18px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-q-text">Pass rate trend</span>
            <span className="font-mono text-[11px] text-q-dim">last 14 days</span>
          </div>
          <PassRateTrendChart runs={runs} />
        </div>

        {/* Runs by result — same window as the stats row (last N fetched runs) */}
        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-q-text">Runs by result</span>
            <span className="font-mono text-[11px] text-q-dim">last {stats.total} runs</span>
          </div>
          <div className="mt-4">
            <TodayByResult
              passed={stats.passed}
              failed={stats.failed}
              total={stats.total}
            />
          </div>
        </div>
      </div>

      {/* Recent runs */}
      <div
        className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel"
      >
        <div
          className="flex items-center justify-between px-[18px] py-[15px]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[13px] font-semibold text-q-text">{t("dashboard.recentRuns")}</span>
          <Link href="/reports" className="text-[12px] font-medium text-q-green transition hover:opacity-80">
            View all →
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-[13px] text-q-muted">
            {t("dashboard.noRuns")}
          </div>
        ) : (
          <div>
            <RecentRunsHeader />
            {recentRuns.map((run) => (
              <RecentRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>

      {/* Test cases by suite */}
      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-q-text">{t("dashboard.testCasesBySuite")}</h3>
        <SuiteTestCasesSection runs={runs} />
      </div>

      <style>{`
        @keyframes blip {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
