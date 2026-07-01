import { getSupabaseAdmin } from "@/lib/supabase";
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

export async function listUsers(): Promise<UserRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as UserRow[]).map(toUserRecord);
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin().from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toUserRecord(data as UserRow) : null;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toUserRecord(data as UserRow) : null;
}

export async function authenticateUser(username: string, password: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as UserRow | null;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return toUserRecord(row);
}

export async function countAdmins(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createUser(input: {
  username: string;
  password: string;
  name?: string;
  role: UserRole;
}): Promise<UserRecord> {
  const db = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await db
    .from("users")
    .select("id")
    .eq("username", input.username)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing) throw new Error("Username is already taken.");

  const { data, error } = await db
    .from("users")
    .insert({
      username: input.username,
      name: input.name ?? null,
      password_hash: hashPassword(input.password),
      role: input.role,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toUserRecord(data as UserRow);
}

export async function updateUser(
  id: number,
  input: { name?: string; role?: UserRole; password?: string }
): Promise<UserRecord> {
  const db = getSupabaseAdmin();
  const current = await getUserById(id);
  if (!current) throw new Error("User not found.");

  if (input.role && input.role !== "admin" && current.role === "admin" && (await countAdmins()) <= 1) {
    throw new Error("Cannot demote the last remaining admin.");
  }

  const patch: Record<string, unknown> = {
    name: input.name !== undefined ? input.name : current.name,
    role: input.role ?? current.role,
  };
  if (input.password) patch.password_hash = hashPassword(input.password);

  const { data, error } = await db.from("users").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return toUserRecord(data as UserRow);
}

export async function deleteUser(id: number): Promise<void> {
  const db = getSupabaseAdmin();
  const current = await getUserById(id);
  if (!current) throw new Error("User not found.");

  if (current.role === "admin" && (await countAdmins()) <= 1) {
    throw new Error("Cannot delete the last remaining admin.");
  }

  // No ON DELETE CASCADE surprises to worry about client-side, but sessions
  // are removed explicitly first in case cascade isn't set up identically.
  await db.from("sessions").delete().eq("user_id", id);
  const { error } = await db.from("users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
