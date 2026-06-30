"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { StatsCards } from "@/components/StatsCards";
import { RefreshButton } from "@/components/RefreshButton";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import type { RunsResponse, RunSummary, TriggerResponse, WorkflowsResponse } from "@/lib/types";

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
  let prev = 0.95;
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

// Type badge (Playwright / API / K6)
const TYPE_BADGE: Record<RunSummary["runType"], { label: string; color: string; bg: string }> = {
  frontend: { label: "Playwright", color: "#8b5cf6", bg: "rgba(139,92,246,0.14)" },
  api: { label: "API", color: "#2dd4bf", bg: "rgba(45,212,191,0.14)" },
  load: { label: "K6", color: "#ff5fa2", bg: "rgba(255,95,162,0.14)" },
};

function RecentRunRow({ run }: { run: RunSummary }) {
  const dot = statusDotColor(run);
  const badge = TYPE_BADGE[run.runType];
  const isLive = run.status === "in_progress" || run.status === "queued";

  let countLabel: string;
  if (run.status === "in_progress") countLabel = "running";
  else if (run.status === "queued") countLabel = "queued";
  else if (run.conclusion === "failure") countLabel = "failed";
  else countLabel = "—";

  const countColor =
    run.status === "in_progress"
      ? "#5b9dff"
      : run.conclusion === "failure"
      ? "#ff5d5d"
      : run.conclusion === "success"
      ? "#b9c0c9"
      : "#8a93a0";

  return (
    <div
      className="flex items-center gap-[14px] px-[18px] py-[13px]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Status dot */}
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: dot,
          ...(isLive ? { animation: "blip 1.2s infinite" } : {}),
        }}
      />

      {/* Name + file path */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-q-text">{run.name}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-q-dim">
          #{run.runNumber}
          {run.branch ? ` · ${run.branch}` : ""}
        </div>
      </div>

      {/* Type badge */}
      <span
        className="shrink-0 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
        style={{ color: badge.color, background: badge.bg }}
      >
        {badge.label}
      </span>

      {/* Count/status */}
      <span
        className="w-[54px] shrink-0 font-mono text-[12px] font-medium"
        style={{ color: countColor }}
      >
        {countLabel}
      </span>

      {/* Duration */}
      <span className="w-[52px] shrink-0 font-mono text-[12px] text-q-muted">
        {formatDuration(run.durationSec)}
      </span>

      {/* Time ago */}
      <span className="w-[62px] shrink-0 text-right text-[12px] text-q-dim">
        {formatRelativeTime(run.createdAt)}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: workflowsData, mutate: mutateWorkflows } = useSWR<WorkflowsResponse>(
    "/api/workflows",
    fetcher,
    { refreshInterval: 15000 }
  );
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>(
    "/api/runs?per_page=20",
    fetcher,
    { refreshInterval: 15000 }
  );

  const handleRefresh = async () => {
    await Promise.all([mutateWorkflows(), mutateRuns()]);
  };

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
            {getGreeting()}, QA Team
          </h2>
          <p className="mt-[3px] text-[12.5px] text-q-muted">
            miit.web · production · last sync just now
          </p>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
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

        {/* Today by result */}
        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-[18px]">
          <span className="text-[13px] font-semibold text-q-text">Today by result</span>
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
          <span className="text-[13px] font-semibold text-q-text">Recent runs</span>
          <Link href="/reports" className="text-[12px] font-medium text-q-green transition hover:opacity-80">
            View all →
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <div className="px-[18px] py-8 text-center text-[13px] text-q-muted">
            No runs yet
          </div>
        ) : (
          <div>
            {recentRuns.map((run) => (
              <RecentRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
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
