"use client";

import { useState } from "react";
import type { WorkflowSummary } from "@/lib/types";

export function SuiteCard({
  workflow,
  onRun,
}: {
  workflow: WorkflowSummary;
  onRun: (workflowId: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "triggered" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setStatus("running");
    setError(null);

    const result = await onRun(workflow.id);

    if (result.ok) {
      setStatus("triggered");
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setStatus("error");
      setError(result.error ?? "Failed to trigger run");
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-lg border border-surface-border bg-surface-panel p-4">
      <div>
        <h3 className="font-medium text-white">{workflow.name}</h3>
        <p className="mt-1 text-xs text-gray-500">{workflow.path}</p>
        {workflow.state !== "active" && (
          <p className="mt-1 text-xs text-amber-500">workflow is {workflow.state}</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <a
          href={workflow.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          View on GitHub
        </a>
        <button
          onClick={handleRun}
          disabled={status === "running" || status === "triggered"}
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed",
            status === "triggered"
              ? "bg-emerald-600"
              : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-70",
          ].join(" ")}
        >
          {status === "running" && (
            <svg
              className="h-3.5 w-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {status === "triggered" && (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "running" ? "Running…" : status === "triggered" ? "Triggered!" : "Run"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
