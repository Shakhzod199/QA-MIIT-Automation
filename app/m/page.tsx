"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import { formatRelativeTime } from "@/lib/format";
import type {
  RunSummary,
  RunsResponse,
  TriggerResponse,
  WorkflowsResponse,
} from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function statusPill(run: RunSummary, t: (k: string) => string) {
  if (run.status === "in_progress")
    return { label: t("status.running"), cls: "bg-blue-500/15 text-blue-300 ring-blue-500/30" };
  if (run.status === "queued")
    return { label: t("status.queued"), cls: "bg-gray-500/15 text-gray-400 ring-gray-500/30" };
  if (run.conclusion === "success")
    return { label: t("status.passed"), cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" };
  if (run.conclusion === "failure")
    return { label: t("status.failed"), cls: "bg-red-500/15 text-red-300 ring-red-500/30" };
  if (run.conclusion === "cancelled")
    return { label: t("status.cancelled"), cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" };
  return { label: run.conclusion ?? "—", cls: "bg-gray-500/15 text-gray-400 ring-gray-500/30" };
}

export default function MobileDashboard() {
  const { t } = useI18n();
  const { data: workflowsData } = useSWR<WorkflowsResponse>("/api/workflows", fetcher, {
    refreshInterval: 15000,
  });
  const { data: runsData, mutate: mutateRuns } = useSWR<RunsResponse>(
    "/api/runs?per_page=20",
    fetcher,
    { refreshInterval: 15000 }
  );

  const [pending, setPending] = useState<Record<number, boolean>>({});

  const workflows = workflowsData?.workflows ?? [];
  const runs = runsData?.runs ?? [];
  const stats = runsData?.stats;

  const activeWorkflowIds = useMemo(() => {
    const ids = new Set<number>();
    for (const run of runs) if (run.status !== "completed") ids.add(run.workflowId);
    return ids;
  }, [runs]);

  const runSuite = async (workflowId: number) => {
    setPending((p) => ({ ...p, [workflowId]: true }));
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    });
    const result: TriggerResponse = await res.json();
    if (result.ok) setTimeout(() => mutateRuns(), 2000);
    setTimeout(() => setPending((p) => ({ ...p, [workflowId]: false })), 2500);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-white">{t("dashboard.title")}</h1>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label={t("trends.passRate")} value={stats ? `${stats.passRate}%` : "—"} />
        <StatTile label={t("trends.failRate")} value={stats ? `${stats.failRate}%` : "—"} />
        <StatTile label="Total" value={stats ? String(stats.total) : "—"} />
        <StatTile
          label={t("table.triggered")}
          value={stats?.lastRunAt ? formatRelativeTime(stats.lastRunAt) : "—"}
        />
      </div>

      {/* suites */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-300">{t("dashboard.suites")}</h2>
        <div className="space-y-2.5">
          {workflows.map((wf) => {
            const busy = pending[wf.id] || activeWorkflowIds.has(wf.id);
            return (
              <div
                key={wf.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-panel p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{wf.name}</p>
                  <p className="truncate text-[11px] text-gray-500">{wf.path}</p>
                </div>
                <button
                  onClick={() => runSuite(wf.id)}
                  disabled={busy}
                  className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {busy ? t("suite.running") : t("suite.run")}
                </button>
              </div>
            );
          })}
          {workflows.length === 0 && (
            <p className="rounded-lg border border-surface-border bg-surface-panel p-5 text-center text-sm text-gray-500">
              {t("dashboard.noWorkflows")}
            </p>
          )}
        </div>
      </div>

      {/* recent runs */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-300">{t("dashboard.recentRuns")}</h2>
        <div className="space-y-2">
          {runs.slice(0, 12).map((run) => {
            const pill = statusPill(run, t);
            return (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-panel px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-300">
                    {run.name} <span className="font-mono text-indigo-400">#{run.runNumber}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">{formatRelativeTime(run.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${pill.cls}`}>
                  {pill.label}
                </span>
              </div>
            );
          })}
          {runs.length === 0 && (
            <p className="rounded-lg border border-surface-border bg-surface-panel p-5 text-center text-sm text-gray-500">
              {t("dashboard.noRuns")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
