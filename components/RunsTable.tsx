"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";
import { ClipboardCheckIcon, FlaskIcon } from "@/components/icons";
import type { RunSummary } from "@/lib/types";

function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

function estimateDurationSec(runs: RunSummary[]): number {
  const durations = runs
    .filter((r) => r.status === "completed" && r.durationSec != null)
    .map((r) => r.durationSec as number)
    .sort((a, b) => a - b);
  if (durations.length === 0) return 90;
  return durations[Math.floor(durations.length / 2)];
}

function K6ReportLink({ runId }: { runId: number }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/reports/${runId}`}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-q-green transition hover:opacity-80"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {t("table.viewK6Report")}
    </Link>
  );
}

function RunProgressBar({ run, estimateSec }: { run: RunSummary; estimateSec: number }) {
  let pct: number;
  let fillColor: string;
  let label: string;
  let animate = false;

  if (run.status === "in_progress") {
    const elapsed = (Date.now() - new Date(run.createdAt).getTime()) / 1000;
    pct = Math.min(95, Math.max(4, (elapsed / estimateSec) * 100));
    fillColor = "#5b9dff";
    label = `${Math.round(pct)}%`;
    animate = true;
  } else if (run.status === "queued") {
    pct = 8;
    fillColor = "#5b636e";
    label = "Queued";
    animate = true;
  } else {
    pct = 100;
    fillColor =
      run.conclusion === "success"
        ? "#3ddc97"
        : run.conclusion === "failure"
        ? "#ff5d5d"
        : run.conclusion === "cancelled"
        ? "#f5b544"
        : "#5b636e";
    label = "100%";
  }

  return (
    <div
      className="flex items-center gap-2"
      title={
        run.status === "in_progress"
          ? `In progress — ~${Math.round(pct)}% through an estimated ${formatDuration(estimateSec)}`
          : run.status === "queued"
          ? "Queued — not started yet"
          : `Completed — ${run.conclusion ?? "unknown outcome"}`
      }
    >
      <div
        className="h-[6px] w-24 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${animate ? "motion-safe:animate-pulse" : ""}`}
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-q-dim">{label}</span>
    </div>
  );
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  const { t } = useI18n();
  if (status === "in_progress") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
        style={{ background: "rgba(91,157,255,0.14)", color: "#5b9dff" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "#5b9dff" }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#5b9dff" }} />
        </span>
        {t("status.running")}
      </span>
    );
  }
  if (status === "queued") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
        style={{ background: "rgba(91,99,110,0.2)", color: "#8a93a0" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#5b636e]" />
        {t("status.queued")}
      </span>
    );
  }
  switch (conclusion) {
    case "success":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
          style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {t("status.passed")}
        </span>
      );
    case "failure":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
          style={{ background: "rgba(255,93,93,0.12)", color: "#ff5d5d" }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t("status.failed")}
        </span>
      );
    case "cancelled":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
          style={{ background: "rgba(245,181,68,0.14)", color: "#f5b544" }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
          </svg>
          {t("status.cancelled")}
        </span>
      );
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
          style={{ background: "rgba(91,99,110,0.2)", color: "#8a93a0" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#5b636e]" />
          {conclusion ?? "Unknown"}
        </span>
      );
  }
}

function RunTypeBadge({ runType }: { runType: RunSummary["runType"] }) {
  const { t } = useI18n();
  const MAP = {
    frontend: { color: "#8b5cf6", bg: "rgba(139,92,246,0.14)", label: t("table.typeFrontend") },
    api: { color: "#2dd4bf", bg: "rgba(45,212,191,0.14)", label: t("table.typeApi") },
    load: { color: "#ff5fa2", bg: "rgba(255,95,162,0.14)", label: t("table.typeLoad") },
  };
  const s = MAP[runType];
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function TriggerSourceBadge({ source }: { source: RunSummary["triggerSource"] }) {
  const { t } = useI18n();
  if (source === "ci-cd") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
        style={{ background: "rgba(139,92,246,0.14)", color: "#8b5cf6" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" />
        {t("table.triggerCi")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] font-mono text-[10.5px] font-semibold"
      style={{ background: "rgba(91,99,110,0.2)", color: "#8a93a0" }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#5b636e]" />
      {t("table.triggerManual")}
    </span>
  );
}

function CancelButton({
  runId,
  onCancel,
}: {
  runId: number;
  onCancel: (runId: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "cancelling" | "error">("idle");

  const handleClick = async () => {
    setState("cancelling");
    const result = await onCancel(runId);
    setState(result.ok ? "cancelling" : "error");
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "cancelling"}
      title={state === "error" ? "Cancel failed — try again" : "Cancel this run"}
      className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 font-mono text-[10.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
      style={
        state === "error"
          ? { background: "rgba(255,93,93,0.12)", color: "#ff5d5d" }
          : { background: "rgba(255,93,93,0.08)", color: "#ff5d5d" }
      }
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="1.5" strokeWidth={2} />
      </svg>
      {state === "cancelling" ? t("table.cancelling") : t("table.cancel")}
    </button>
  );
}

export function RunsTable({
  runs,
  hideProject = false,
  pageSize = 5,
  onCancel,
}: {
  runs: RunSummary[];
  hideProject?: boolean;
  pageSize?: number;
  onCancel?: (runId: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { t } = useI18n();
  const hasActiveRun = runs.some((run) => run.status !== "completed");
  useTicker(hasActiveRun);
  const estimateSec = estimateDurationSec(runs);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(runs.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const visibleRuns = runs.slice(start, start + pageSize);

  if (runs.length === 0) {
    return (
      <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
        {t("dashboard.noRuns")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface-panel">
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[19%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-surface-border font-mono text-[10px] uppercase tracking-wide text-q-dim">
            <th className="px-4 py-3 font-semibold">{t("table.run")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.type")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.status")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.progress")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.duration")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.triggered")}</th>
            <th className="px-4 py-3 font-semibold">{t("table.triggerSource")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visibleRuns.map((run) => (
            <tr
              key={run.id}
              className="border-b border-surface-border last:border-0 transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e2229")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/reports/${run.id}`} className="group flex items-center gap-1.5">
                    {!hideProject && (
                      <span className="text-[12px] text-q-muted transition group-hover:text-q-text">
                        {run.name}
                      </span>
                    )}
                    <span className="font-mono text-[12px] text-q-green transition group-hover:opacity-80">
                      #{run.runNumber}
                    </span>
                  </Link>
                  {run.testFilter && (
                    <span
                      title={run.testFilter}
                      className="inline-flex max-w-full items-center gap-1 rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-medium"
                      style={{ background: "rgba(61,220,151,0.12)", color: "#3ddc97" }}
                    >
                      <FlaskIcon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        {run.runType === "load"
                          ? run.testFilter.charAt(0).toUpperCase() + run.testFilter.slice(1)
                          : t("table.singleTest")}
                      </span>
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <RunTypeBadge runType={run.runType} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={run.status} conclusion={run.conclusion} />
              </td>
              <td className="px-4 py-3">
                {run.runType === "load" && run.status === "completed" ? (
                  <K6ReportLink runId={run.id} />
                ) : (
                  <RunProgressBar run={run} estimateSec={estimateSec} />
                )}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {run.status === "in_progress" ? (
                  <span className="font-mono text-[12px] text-[#5b9dff]">
                    {formatDuration(Math.max(0, Math.floor((Date.now() - new Date(run.createdAt).getTime()) / 1000)))}
                  </span>
                ) : (
                  <span className="font-mono text-[12px] text-q-muted">{formatDuration(run.durationSec)}</span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-q-dim">
                {formatRelativeTime(run.createdAt)}
              </td>
              <td className="px-4 py-3">
                <TriggerSourceBadge source={run.triggerSource} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {onCancel && run.status !== "completed" && (
                    <CancelButton runId={run.id} onCancel={onCancel} />
                  )}
                  {run.status === "completed" && run.runType !== "load" && (
                    <Link
                      href={`/reports/${run.id}/summary`}
                      title={t("table.viewResults")}
                      className="inline-flex items-center justify-center rounded-[6px] p-1.5 text-q-dim transition hover:bg-surface-hover hover:text-q-text"
                    >
                      <ClipboardCheckIcon className="h-4 w-4" />
                    </Link>
                  )}
                  <a
                    href={run.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="View on GitHub"
                    className="inline-flex items-center justify-center rounded-[6px] p-1.5 text-q-dim transition hover:bg-surface-hover hover:text-q-text"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 font-mono text-[11px] text-q-dim"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="tabular-nums">
            {start + 1}–{Math.min(start + pageSize, runs.length)} {t("table.of")} {runs.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="rounded-[6px] px-2.5 py-1 font-medium text-q-muted transition hover:bg-surface-hover hover:text-q-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← {t("table.prev")}
            </button>
            <span className="px-1.5 tabular-nums text-q-muted">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="rounded-[6px] px-2.5 py-1 font-medium text-q-muted transition hover:bg-surface-hover hover:text-q-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("table.next")} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
