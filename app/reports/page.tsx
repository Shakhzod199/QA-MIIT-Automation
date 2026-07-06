"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ReportCard } from "@/components/ReportCard";
import { RefreshButton } from "@/components/RefreshButton";
import { useI18n } from "@/components/I18nProvider";
import { runsRefreshInterval } from "@/lib/runsPolling";
import type { RunsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_FILTERS = [
  { value: "all", key: "common.all" },
  { value: "success", key: "status.passed" },
  { value: "failure", key: "status.failed" },
  { value: "running", key: "status.running" },
  { value: "cancelled", key: "status.cancelled" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];
type SortOrder = "newest" | "oldest";

export default function ReportsPage() {
  const { t } = useI18n();
  const { data, mutate } = useSWR<RunsResponse>("/api/runs?per_page=50", fetcher, {
    refreshInterval: runsRefreshInterval,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const runs = data?.runs ?? [];

  const projectNames = useMemo(() => {
    const names = new Set(runs.map((r) => r.name));
    return Array.from(names).sort();
  }, [runs]);

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = runs.filter((run) => {
      if (projectFilter !== "all" && run.name !== projectFilter) return false;
      if (statusFilter === "running" && run.status === "completed") return false;
      if (statusFilter === "success" && !(run.status === "completed" && run.conclusion === "success")) return false;
      if (statusFilter === "failure" && !(run.status === "completed" && run.conclusion === "failure")) return false;
      if (statusFilter === "cancelled" && !(run.status === "completed" && run.conclusion === "cancelled")) return false;

      if (!query) return true;
      return (
        run.name.toLowerCase().includes(query) ||
        String(run.runNumber).includes(query) ||
        (run.branch ?? "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });
  }, [runs, search, statusFilter, projectFilter, sortOrder]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-surface-border pb-5">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.4px] text-q-text">{t("reports.title")}</h2>
          <p className="mt-[3px] text-[12.5px] text-q-muted">{t("reports.subtitle")}</p>
        </div>
        <RefreshButton onRefresh={() => mutate()} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder={t("reports.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-[9px] border border-surface-border bg-surface-panel px-3 py-2 text-[13px] text-q-text placeholder:text-q-dim focus:outline-none sm:max-w-sm"
          style={{ caretColor: "#3ddc97" }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[9px] border border-surface-border bg-surface-panel p-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className="rounded-[6px] px-3 py-1 text-[12px] font-medium transition"
                style={
                  statusFilter === filter.value
                    ? { background: "rgba(61,220,151,0.14)", color: "#3ddc97" }
                    : { color: "#8a93a0" }
                }
              >
                {t(filter.key)}
              </button>
            ))}
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-[9px] border border-surface-border bg-surface-panel px-3 py-2 text-[12px] text-q-text focus:outline-none"
          >
            <option value="all">{t("reports.allProjects")}</option>
            {projectNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="rounded-[9px] border border-surface-border bg-surface-panel px-3 py-2 text-[12px] text-q-text focus:outline-none"
          >
            <option value="newest">{t("reports.newest")}</option>
            <option value="oldest">{t("reports.oldest")}</option>
          </select>
        </div>
      </div>

      <p className="font-mono text-[11px] text-q-dim">{filteredRuns.length} {t("reports.shown")}</p>

      {filteredRuns.length === 0 ? (
        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
          {t("reports.noMatch")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRuns.map((run) => (
            <ReportCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
