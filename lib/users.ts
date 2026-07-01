import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { UserRecord, UserRole } from "@/lib/types";

interface UserRow {
  id: number;
  username: string;
  name: string | null;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

function toUserRecord(row: UserRow): UserRecord {
  return { id: row.id, username: row.username, name: row.name, role: row.role, createdAt: row.created_at };
}

export function listUsers(): UserRecord[] {
  const rows = getDb().prepare("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
  return rows.map(toUserRecord);
}

export function getUserById(id: number): UserRecord | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUserRecord(row) : null;
}

export function getUserByUsername(username: string): UserRecord | null {
  const row = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  return row ? toUserRecord(row) : null;
}

export function authenticateUser(username: string, password: string): UserRecord | null {
  const row = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return toUserRecord(row);
}

export function countAdmins(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin'").get() as { n: number };
  return row.n;
}

export function createUser(input: { username: string; password: string; name?: string; role: UserRole }): UserRecord {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(input.username);
  if (existing) throw new Error("Username is already taken.");

  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(input.username, input.name ?? null, hashPassword(input.password), input.role, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    username: input.username,
    name: input.name ?? null,
    role: input.role,
    createdAt,
  };
}

export function updateUser(
  id: number,
  input: { name?: string; role?: UserRole; password?: string }
): UserRecord {
  const db = getDb();
  const current = getUserById(id);
  if (!current) throw new Error("User not found.");

  if (input.role && input.role !== "admin" && current.role === "admin" && countAdmins() <= 1) {
    throw new Error("Cannot demote the last remaining admin.");
  }

  const name = input.name !== undefined ? input.name : current.name;
  const role = input.role ?? current.role;

  if (input.password) {
    db.prepare("UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?").run(
      name,
      role,
      hashPassword(input.password),
      id
    );
  } else {
    db.prepare("UPDATE users SET name = ?, role = ? WHERE id = ?").run(name, role, id);
  }

  return { id, username: current.username, name, role, createdAt: current.createdAt };
}

export function deleteUser(id: number): void {
  const db = getDb();
  const current = getUserById(id);
  if (!current) throw new Error("User not found.");

  if (current.role === "admin" && countAdmins() <= 1) {
    throw new Error("Cannot delete the last remaining admin.");
  }

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}
