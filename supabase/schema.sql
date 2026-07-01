-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Replaces the old SQLite-backed users/sessions tables from lib/db.ts.

create table if not exists users (
  id bigint generated always as identity primary key,
  username text not null unique,
  name text,
  password_hash text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);

-- Row Level Security -------------------------------------------------------
-- The app never queries these tables from the browser: all reads/writes go
-- through Next.js Route Handlers using the SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS by design. Admin/editor/viewer authorization is enforced in
-- application code (middleware.ts + the /api/users route handlers), not by
-- these policies.
--
-- RLS is still enabled here as defense-in-depth: if the anon/public key ever
-- leaked or got used directly against these tables, this default-deny
-- policy set means it can read or write nothing. There are intentionally NO
-- policies granting access to `anon` or `authenticated` — only the service
-- role (which ignores RLS) can touch these tables.
alter table users enable row level security;
alter table sessions enable row level security;

revoke all on users from anon, authenticated;
revoke all on sessions from anon, authenticated;
