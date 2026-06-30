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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-0.4px] text-q-text">{t("flaky.title")}</h2>
          <p className="mt-[3px] max-w-2xl text-[12.5px] text-q-muted">{t("flaky.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-q-dim">{t("flaky.analyzeLast")}</span>
          <div className="flex items-center gap-1 rounded-[9px] border border-surface-border bg-surface-panel p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindowSize(w)}
                className="rounded-[6px] px-2.5 py-1 font-mono text-[11px] font-medium transition"
                style={windowSize === w ? { background: "#1e2229", color: "#e8ecf1" } : { color: "#8a93a0" }}
              >
                {w}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-q-dim">{t("flaky.runs")}</span>
        </div>
      </div>

      {data && !data.configured && (
        <div className="rounded-[10px] border p-4 text-[13px]" style={{ borderColor: "rgba(245,181,68,0.3)", background: "rgba(245,181,68,0.08)", color: "#f5b544" }}>
          GitHub is not configured yet.
        </div>
      )}

      {data?.error && (
        <div className="rounded-[10px] border p-4 text-[13px]" style={{ borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.08)", color: "#ff5d5d" }}>
          {data.error}
        </div>
      )}

      {data && data.configured && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-q-dim">
          <span>
            Analyzed <span className="font-medium text-q-sub">{data.runsAnalyzed}</span> of{" "}
            {data.windowRequested} requested runs
          </span>
          <span>
            <span className="font-medium text-[#f5b544]">{data.tests.length}</span> flaky test
            {data.tests.length !== 1 ? "s" : ""} found
          </span>
          <span>Updated {formatRelativeTime(data.generatedAt)}</span>
        </div>
      )}

      {isLoading && !data ? (
        <div className="rounded-[12px] border border-surface-border bg-surface-panel p-8 text-center text-[13px] text-q-muted">
          Downloading and parsing recent report artifacts…
        </div>
      ) : data?.configured ? (
        <FlakyTests tests={data.tests} />
      ) : null}
    </div>
  );
}
