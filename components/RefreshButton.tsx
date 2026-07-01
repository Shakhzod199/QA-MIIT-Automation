"use client";

import { useState } from "react";

export function RefreshButton({
  onRefresh,
  disabled = false,
  title,
}: {
  onRefresh: () => Promise<unknown>;
  disabled?: boolean;
  title?: string;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
    if (disabled) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={refreshing || disabled}
      title={title}
      className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "#3ddc97", color: "#06140d" }}
    >
      {refreshing ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Refreshing…
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </>
      )}
    </button>
  );
}
