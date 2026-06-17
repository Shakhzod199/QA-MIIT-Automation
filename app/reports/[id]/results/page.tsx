"use client";

import { use, useState } from "react";
import Link from "next/link";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={`/reports/${id}`} className="hover:text-white transition-colors">
            ← Back to Run
          </Link>
          <span>/</span>
          <span className="text-white">Test Report</span>
        </div>
        <a
          href={`/reports/${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-panel px-3 py-1.5 text-xs text-gray-400 transition hover:border-gray-500 hover:text-gray-200"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Run details
        </a>
      </div>

      {/* Report frame */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-surface-border bg-surface-panel" style={{ minHeight: "calc(100vh - 140px)" }}>
        {/* Loading overlay */}
        {!loaded && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-surface-panel">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-200">Loading Playwright report</p>
              <p className="mt-1 text-xs text-gray-500">Fetching and extracting test artifact…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-surface-panel">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-200">Report unavailable</p>
              <p className="mt-1 text-xs text-gray-500">The artifact may have expired or the run is still in progress.</p>
            </div>
            <Link
              href={`/reports/${id}`}
              className="rounded-md bg-surface-hover px-4 py-2 text-sm text-gray-300 transition hover:text-white"
            >
              ← Back to run details
            </Link>
          </div>
        )}

        <iframe
          src={`/api/runs/${id}/report/index.html`}
          className={`h-full w-full transition-opacity duration-500 ${loaded && !error ? "opacity-100" : "opacity-0"}`}
          style={{ minHeight: "calc(100vh - 140px)" }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="Playwright Test Report"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}
