// One-time bootstrap: creates the first admin account in Supabase.
// Run this once after applying supabase/schema.sql, before you can log in.
//
//   node --env-file=.env.local scripts/seed-admin.mjs <username> <password> [role]
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { randomBytes, scryptSync } from "crypto";
import { createClient } from "@supabase/supabase-js";

const [, , username, password, role = "admin"] = process.argv;

if (!username || !password) {
  console.error("Usage: node --env-file=.env.local scripts/seed-admin.mjs <username> <password> [role]");
  process.exit(1);
}

if (!["admin", "editor", "viewer"].includes(role)) {
  console.error(`Invalid role "${role}" — must be admin, editor, or viewer.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

// Must match lib/password.ts exactly, or the app won't be able to verify this hash.
function hashPassword(raw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(raw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const supabase = createClient(url, serviceRoleKey);

const { data: existing, error: lookupError } = await supabase
  .from("users")
  .select("id")
  .eq("username", username)
  .maybeSingle();
if (lookupError) {
  console.error("Lookup failed:", lookupError.message);
  process.exit(1);
}
if (existing) {
  console.error(`User "${username}" already exists (id ${existing.id}).`);
  process.exit(1);
}

const { data, error } = await supabase
  .from("users")
  .insert({ username, password_hash: hashPassword(password), role })
  .select("id, username, role")
  .single();

if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}

console.log(`Created ${data.role} "${data.username}" (id ${data.id}). You can log in with it now.`);
