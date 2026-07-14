import { getSupabaseAdmin } from "@/lib/supabase";

// Audit trail only now — the /users dashboard shows live presence
// (components/OnlineUsers.tsx) instead of a day-by-day login count, since a
// login event says nothing about whether that session is still active.
// Best-effort: a logging hiccup here should never block someone's login.
export async function recordLogin(userId: number): Promise<void> {
  const { error } = await getSupabaseAdmin().from("login_events").insert({ user_id: userId });
  if (error) console.error("Failed to record login event:", error.message);
}
