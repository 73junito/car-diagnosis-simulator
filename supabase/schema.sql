-- Supabase schema for Car Diagnosis Simulator
-- Includes telemetry events, session history, analytics aggregates, scenarios, diagnosis steps, users
-- Run this in your Supabase SQL editor or psql connected to your project

-- Extensions
create extension if not exists pgcrypto;

-- telemetry_events: raw event stream (JSONB payload)
create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  session_id text,
  user_id uuid,
  scenario_id text,
  payload jsonb not null,
  metadata jsonb,
  source text,
  inserted_at timestamptz not null default now()
);
create index if not exists telemetry_events_type_idx on telemetry_events (type);
create index if not exists telemetry_events_session_idx on telemetry_events (session_id);
create index if not exists telemetry_events_scenario_idx on telemetry_events (scenario_id);
create index if not exists telemetry_events_created_at_idx on telemetry_events (created_at desc);
create index if not exists telemetry_events_payload_gin on telemetry_events using gin (payload);

-- session_history: ordered timeline of session steps for replay
create table if not exists session_history (
  id bigserial primary key,
  session_id text not null,
  step integer not null,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists session_history_session_idx on session_history (session_id);
create index if not exists session_history_created_at_idx on session_history (created_at desc);

-- scenarios: metadata for available scenarios
create table if not exists scenarios (
  id text primary key,
  title text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- diagnosis_steps: ordered steps per scenario
create table if not exists diagnosis_steps (
  id bigserial primary key,
  scenario_id text not null references scenarios(id) on delete cascade,
  step_number integer not null,
  title text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists diagnosis_steps_scenario_step_idx on diagnosis_steps (scenario_id, step_number);

-- analytics_daily: precomputed daily aggregates for fast dashboards
create table if not exists analytics_daily (
  date date primary key,
  total_sessions integer not null default 0,
  avg_confidence numeric(8,4),
  top_errors jsonb,
  created_at timestamptz not null default now()
);

-- analytics_students: per-student precomputed aggregates
create table if not exists analytics_students (
  user_id uuid primary key,
  total_sessions integer not null default 0,
  avg_score numeric(8,4),
  avg_confidence numeric(8,4),
  last_seen timestamptz
);

-- users: optional profiles (works with Supabase Auth or anonymous users)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  anonymous boolean default true,
  display_name text,
  preferences jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);

-- Helpful views
create view if not exists vw_telemetry_events_recent as
  select id, created_at, type, session_id, user_id, scenario_id, payload
  from telemetry_events
  order by created_at desc
  limit 100;

-- Notes / recommendations:
-- 1) For high-frequency events, buffer on the client and batch-insert to Supabase every 1-5s.
-- 2) Add appropriate RLS policies before production to protect user data.
-- 3) Consider creating a background job (Edge Function or cron) to roll up daily analytics into `analytics_daily`.
-- 4) Add indexes on JSONB keys you query frequently, e.g. (payload ->> 'someKey').


-- End of schema
