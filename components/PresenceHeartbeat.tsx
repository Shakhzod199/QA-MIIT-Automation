"use client";

import { useEffect } from "react";

// Kept comfortably under lib/presence.ts's 2-minute online window so a
// single dropped request doesn't flip someone offline.
const HEARTBEAT_INTERVAL_MS = 45_000;

/** Mounted once for any signed-in user; pings /api/heartbeat so "online now" reflects reality. */
export function PresenceHeartbeat() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("focus", ping);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", ping);
    };
  }, []);

  return null;
}
