"use client";

import { useState } from "react";

export function RefreshButton({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
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
      disabled={refreshing}
      className="rounded-md border border-surface-border bg-surface-hover px-3 py-1.5 text-sm font-medium text-gray-200 transition hover:bg-surface-border disabled:cursor-not-allowed disabled:opacity-50"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
