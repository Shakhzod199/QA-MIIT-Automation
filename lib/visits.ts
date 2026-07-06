import { getSupabaseAdmin } from "@/lib/supabase";
import type { DailyVisits } from "@/lib/types";

// Best-effort: a logging hiccup here should never block someone's login.
export async function recordLogin(userId: number): Promise<void> {
  const { error } = await getSupabaseAdmin().from("login_events").insert({ user_id: userId });
  if (error) console.error("Failed to record login event:", error.message);
}

/** Login counts per UTC calendar day for the last `days` days, oldest → newest. */
export async function getDailyVisits(days = 14): Promise<DailyVisits[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await getSupabaseAdmin()
    .from("login_events")
    .select("created_at, users(username)")
    .gte("created_at", since.toISOString());
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  const usersByDay = new Map<string, Set<string>>();
  for (const row of data as {
    created_at: string;
    users: { username: string } | { username: string }[] | null;
  }[]) {
    const day = row.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);

    const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
    if (userRow?.username) {
      if (!usersByDay.has(day)) usersByDay.set(day, new Set());
      usersByDay.get(day)!.add(userRow.username);
    }
  }

  const result: DailyVisits[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: key,
      count: counts.get(key) ?? 0,
      users: Array.from(usersByDay.get(key) ?? []).sort(),
    });
  }
  return result;
}
