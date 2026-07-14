import { getSupabaseAdmin } from "@/lib/supabase";
import type { OnlineUser } from "@/lib/types";

// A tab open and sending heartbeats every ~45s is "online"; anything older
// than this is assumed closed/idle. Kept above 2x the client interval
// (components/PresenceHeartbeat.tsx) so one missed beat doesn't flicker
// someone offline.
const ONLINE_WINDOW_MS = 1000 * 60 * 2;

interface SessionUserRow {
  id: number;
  username: string;
  name: string | null;
}

// Best-effort: a heartbeat hiccup should never surface as an error to the user.
export async function touchSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .update({ last_seen: new Date().toISOString() })
    .eq("token", token);
  if (error) console.error("Failed to update session last_seen:", error.message);
}

/** Users with a live, unexpired session that has sent a heartbeat recently. */
export async function getOnlineUsers(): Promise<OnlineUser[]> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .select("users(id, username, name)")
    .gte("last_seen", since)
    .gt("expires_at", now);
  if (error) throw new Error(error.message);

  const byId = new Map<number, OnlineUser>();
  for (const row of data as { users: SessionUserRow | SessionUserRow[] | null }[]) {
    const u = Array.isArray(row.users) ? row.users[0] : row.users;
    if (u) byId.set(u.id, { id: u.id, username: u.username, name: u.name });
  }
  return Array.from(byId.values()).sort((a, b) => a.username.localeCompare(b.username));
}
