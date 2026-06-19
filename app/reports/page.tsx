"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ReportCard } from "@/components/ReportCard";
import { RefreshButton } from "@/components/RefreshButton";
import { useI18n } from "@/components/I18nProvider";
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
    refreshInterval: 15000,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t("reports.title")}</h2>
          <p className="text-sm text-gray-500">{t("reports.subtitle")}</p>
        </div>
        <RefreshButton onRefresh={() => mutate()} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder={t("reports.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-surface-border bg-surface-panel px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-surface-border bg-surface-panel p-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  statusFilter === filter.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t(filter.key)}
              </button>
            ))}
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-md border border-surface-border bg-surface-panel px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">{t("reports.allProjects")}</option>
            {projectNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="rounded-md border border-surface-border bg-surface-panel px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="newest">{t("reports.newest")}</option>
            <option value="oldest">{t("reports.oldest")}</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500">{filteredRuns.length} {t("reports.shown")}</p>

      {filteredRuns.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
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
