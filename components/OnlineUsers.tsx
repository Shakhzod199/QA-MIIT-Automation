"use client";

import useSWR from "swr";
import { useI18n } from "@/components/I18nProvider";
import type { OnlineUsersResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function OnlineUsers() {
  const { t } = useI18n();
  // Polls a bit faster than the client heartbeat interval so the list feels live.
  const { data } = useSWR<OnlineUsersResponse>("/api/users/online", fetcher, { refreshInterval: 20_000 });
  const users = data?.users ?? [];

  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {users.length > 0 && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ddc97] opacity-75" />
          )}
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: users.length > 0 ? "#3ddc97" : "rgba(255,255,255,0.2)" }}
          />
        </span>
        <span className="text-[13px] font-semibold text-q-text">
          {t("users.onlineCount").replace("{n}", String(users.length))}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {users.length === 0 && <span className="text-[12px] text-q-muted">{t("users.noOneOnline")}</span>}
        {users.map((u) => (
          <span
            key={u.id}
            className="rounded-full border border-surface-border px-2.5 py-1 text-[12px] text-q-text"
          >
            {u.name || u.username}
          </span>
        ))}
      </div>
    </div>
  );
}
