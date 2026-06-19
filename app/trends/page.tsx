"use client";

import { useState } from "react";
import useSWR from "swr";
import { TrendsView } from "@/components/TrendsCharts";
import { useI18n } from "@/components/I18nProvider";
import type { RunsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const WINDOWS = [25, 50, 100];

export default function TrendsPage() {
  const { t } = useI18n();
  const [count, setCount] = useState(50);
  const { data, isLoading } = useSWR<RunsResponse>(`/api/runs?per_page=${count}`, fetcher, {
    refreshInterval: 30000,
  });

  const runs = data?.runs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t("trends.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t("trends.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t("trends.last")}</span>
          <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-panel p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setCount(w)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  count === w ? "bg-surface-hover text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">{t("trends.runs")}</span>
        </div>
      </div>

      {data && !data.configured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          GitHub is not configured yet.
        </div>
      )}

      {data?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {data.error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
          Loading runs…
        </div>
      ) : (
        <TrendsView runs={runs} />
      )}
    </div>
  );
}
