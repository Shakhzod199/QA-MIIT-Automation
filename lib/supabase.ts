import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: the service role key bypasses RLS, so this must never be
// imported from a "use client" component or sent to the browser. Every
// caller of this module lives in a Server Action or Route Handler.
const globalForSupabase = globalThis as unknown as { __qaSupabaseAdmin?: SupabaseClient };

export function getSupabaseAdmin(): SupabaseClient {
  if (!globalForSupabase.__qaSupabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    }
    globalForSupabase.__qaSupabaseAdmin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return globalForSupabase.__qaSupabaseAdmin;
}
