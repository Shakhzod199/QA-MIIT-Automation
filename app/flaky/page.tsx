"use client";

import { useState } from "react";
import useSWR from "swr";
import { FlakyTests } from "@/components/FlakyTests";
import { useI18n } from "@/components/I18nProvider";
import { formatRelativeTime } from "@/lib/format";
import type { FlakyResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const WINDOWS = [5, 10, 15, 20];

export default function FlakyPage() {
  const { t } = useI18n();
  const [windowSize, setWindowSize] = useState(10);
  const { data, isLoading } = useSWR<FlakyResponse>(`/api/flaky?limit=${windowSize}`, fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t("flaky.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t("flaky.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t("flaky.analyzeLast")}</span>
          <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-panel p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindowSize(w)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  windowSize === w ? "bg-surface-hover text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">{t("flaky.runs")}</span>
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

      {data && data.configured && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            Analyzed <span className="font-medium text-gray-300">{data.runsAnalyzed}</span> of{" "}
            {data.windowRequested} requested runs
          </span>
          <span>
            <span className="font-medium text-amber-300">{data.tests.length}</span> flaky test
            {data.tests.length !== 1 ? "s" : ""} found
          </span>
          <span>Updated {formatRelativeTime(data.generatedAt)}</span>
        </div>
      )}

      {isLoading && !data ? (
        <div className="rounded-lg border border-surface-border bg-surface-panel p-8 text-center text-sm text-gray-500">
          Downloading and parsing recent report artifacts…
        </div>
      ) : data?.configured ? (
        <FlakyTests tests={data.tests} />
      ) : null}
    </div>
  );
}
