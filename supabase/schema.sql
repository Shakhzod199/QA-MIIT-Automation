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

-- GitHub Actions workflow IDs this user may see/act on. Ignored for admins
-- (they always have full access — enforced in app code, not here). Empty
-- array = no projects assigned yet, which for editor/viewer means no access,
-- not "all access". Safe to re-run: no-ops if the column already exists.
alter table users add column if not exists allowed_workflows bigint[] not null default '{}'::bigint[];

create table if not exists sessions (
  token text primary key,
  user_id bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);

-- One row per successful login — powers the daily visits chart on /users.
create table if not exists login_events (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_at_idx on login_events(created_at);
create index if not exists login_events_user_id_idx on login_events(user_id);

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
alter table login_events enable row level security;

revoke all on users from anon, authenticated;
revoke all on sessions from anon, authenticated;
revoke all on login_events from anon, authenticated;
