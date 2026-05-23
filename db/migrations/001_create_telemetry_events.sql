create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  source text not null default 'telemetry',
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_events_session_id
  on telemetry_events(session_id);

create index if not exists idx_telemetry_events_created_at
  on telemetry_events(created_at desc);
