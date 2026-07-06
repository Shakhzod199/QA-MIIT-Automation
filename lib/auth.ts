import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserRecord, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "ds";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days, matches the previous cookie maxAge.

interface SessionUserRow {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  allowed_workflows: number[] | null;
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({ token, user_id: userId, expires_at: expiresAt.toISOString() });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined | null): Promise<UserRecord | null> {
  if (!token) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .select("expires_at, users(id, username, name, role, created_at, allowed_workflows)")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;

  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;

  const row = (Array.isArray(data.users) ? data.users[0] : data.users) as SessionUserRow | null;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    allowedWorkflows: row.allowed_workflows ?? [],
  };
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await getSupabaseAdmin().from("sessions").delete().eq("token", token);
}
