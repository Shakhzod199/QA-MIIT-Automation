"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { StatsCards } from "@/components/StatsCards";
import { SuiteCard } from "@/components/SuiteCard";
import { RunsTable } from "@/components/RunsTable";
import { RefreshButton } from "@/components/RefreshButton";
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

  const handleRun = async (workflowId: number): Promise<TriggerResponse> => {
    const res = await fetch("/api/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    });
    const result: TriggerResponse = await res.json();
    if (result.ok) {
      setTimeout(() => mutateRuns(), 2000);
    }
    return result;
  };

  const configured = workflowsData?.configured ?? runsData?.configured ?? true;
  const workflows = workflowsData?.workflows ?? [];
  const runs = runsData?.runs ?? [];
  const stats = runsData?.stats ?? EMPTY_STATS;

  // Group runs by project (workflow name) preserving insertion order (newest first).
  const projectGroups = useMemo(() => {
    const groups = new Map<string, RunSummary[]>();
    for (const run of runs) {
      if (!groups.has(run.name)) groups.set(run.name, []);
      groups.get(run.name)!.push(run);
    }
    return groups;
  }, [runs]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Dashboard</h2>
          <p className="text-sm text-gray-500">Playwright suite runs for new-export</p>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {!configured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          GitHub is not configured yet. Copy <code>dashboard/.env.local.example</code> to{" "}
          <code>.env.local</code> and set <code>GITHUB_TOKEN</code>, <code>GITHUB_OWNER</code>, and{" "}
          <code>GITHUB_REPO</code>, then restart the dev server.
        </div>
      )}

      <StatsCards stats={stats} />

      <div>
        <h3 className="mb-3 text-lg font-medium text-white">Suites</h3>
        {workflows.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            No workflows found{configured ? "" : " — configure GitHub first"}.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <SuiteCard key={workflow.id} workflow={workflow} onRun={handleRun} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-medium text-white">Recent Runs</h3>
        {runs.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
            No runs yet.
          </div>
        ) : (
          Array.from(projectGroups.entries()).map(([projectName, projectRuns]) => (
            <div key={projectName}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-mono font-medium text-indigo-300">
                  {projectName}
                </span>
                <span className="text-xs text-gray-500">{projectRuns.length} run{projectRuns.length !== 1 ? "s" : ""}</span>
              </div>
              <RunsTable runs={projectRuns.slice(0, 5)} hideProject />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
