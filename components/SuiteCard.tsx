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
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setStatus("running");
    setError(null);

    const result = await onRun(workflow.id);

    if (result.ok) {
      setStatus("idle");
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
          disabled={status === "running"}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "running" ? "Starting…" : "Run"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
