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

-- Bumped by a client heartbeat (see app/api/heartbeat) roughly every 45s
-- while a tab is open. Null means the session was created before this
-- column existed, or has never sent a heartbeat yet. Powers the "online
-- now" indicator on /users — distinct from a login event, which only marks
-- the moment auth succeeded and says nothing about current activity.
alter table sessions add column if not exists last_seen timestamptz;

create index if not exists sessions_last_seen_idx on sessions(last_seen);

-- One row per successful login — an audit trail (see lib/visits.ts). Not used
-- for the /users "online now" indicator, which reads sessions.last_seen instead.
create table if not exists login_events (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_at_idx on login_events(created_at);
create index if not exists login_events_user_id_idx on login_events(user_id);

-- Cached LLM analysis of a test failure (see lib/failureAnalysis.ts).
--
-- Keyed by a fingerprint of (file:line + normalized error text) rather than by
-- run, deliberately: the same failure recurring across runs is analyzed once
-- and reused, so a test that has been broken for a fortnight costs a single
-- generation instead of one per run. A genuinely different error on the same
-- test normalizes differently and gets its own row.
create table if not exists failure_analysis (
  fingerprint  text primary key,
  test_file    text not null,
  test_line    int not null,
  owner        text not null check (owner in ('backend', 'frontend', 'test', 'infra')),
  confidence   text not null check (confidence in ('high', 'medium', 'low')),
  cause_en     text not null,
  cause_uz     text not null,
  cause_ru     text not null,
  -- Null for 'infra': there is no team to message, it just needs a retry.
  message_uz   text,
  model        text not null,
  created_at   timestamptz not null default now()
);

create index if not exists failure_analysis_test_idx on failure_analysis(test_file, test_line);

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
alter table failure_analysis enable row level security;

revoke all on users from anon, authenticated;
revoke all on sessions from anon, authenticated;
revoke all on login_events from anon, authenticated;
revoke all on failure_analysis from anon, authenticated;
