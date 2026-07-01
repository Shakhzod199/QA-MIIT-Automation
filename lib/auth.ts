import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import type { UserRecord, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "ds";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days, matches the previous cookie maxAge.

interface SessionUserRow {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  created_at: string;
}

export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function getSessionUser(token: string | undefined | null): UserRecord | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as SessionUserRow | undefined;

  if (!row) return null;
  return { id: row.id, username: row.username, name: row.name, role: row.role, createdAt: row.created_at };
}

export function deleteSession(token: string | undefined | null): void {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
