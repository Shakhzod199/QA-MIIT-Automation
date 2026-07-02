"use client";

import { SWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * App-wide SWR defaults, tuned for speed on this dashboard:
 *  - revalidateOnFocus off: the data changes on GitHub's clock (runs take
 *    minutes), so refetching every single tab-refocus just burns GitHub API
 *    calls and flickers the UI for nothing. Pages that need live updates opt
 *    into `refreshInterval` explicitly.
 *  - keepPreviousData: navigating between pages / changing a filter shows the
 *    last data instantly while the next loads, instead of a blank loading flash.
 *  - dedupingInterval: collapse duplicate requests for the same key fired close
 *    together (e.g. sidebar + page both wanting /api/workflows) into one call.
 * Per-hook options still override these.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        keepPreviousData: true,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
