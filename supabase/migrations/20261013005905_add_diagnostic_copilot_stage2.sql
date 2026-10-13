begin;

create table if not exists public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('training','technician')),
  vehicle_json jsonb not null default '{}'::jsonb,
  complaint text not null default '',
  state_json jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','closed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.diagnostic_session_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_id text not null references public.source_chunks(chunk_id) on delete restrict,
  claim_id text not null check (btrim(claim_id) <> ''),
  claim_scope text not null default 'general' check (claim_scope in ('general','vehicle-specific')),
  vehicle_match text not null default 'generic' check (vehicle_match in ('exact','partial','generic','unknown')),
  directly_relevant boolean not null default false,
  current_enough boolean not null default true,
  created_at timestamptz not null default now(),
  unique (session_id, chunk_id, claim_id),
  constraint diagnostic_session_evidence_owner_fkey
    foreign key (session_id, user_id)
    references public.diagnostic_sessions(id, user_id)
    on delete cascade
);

create table if not exists public.diagnostic_executions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  operation text not null check (operation in ('plan','report','tool')),
  tool_id text,
  status text not null default 'running' check (status in ('running','succeeded','failed','timed-out')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 2),
  max_attempts integer not null default 1 check (max_attempts between 1 and 2),
  timeout_ms integer not null default 2500 check (timeout_ms between 250 and 5000),
  input_hash text not null,
  result_json jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, idempotency_key),
  unique (id, session_id, user_id),
  constraint diagnostic_executions_owner_fkey
    foreign key (session_id, user_id)
    references public.diagnostic_sessions(id, user_id)
    on delete cascade
);

create table if not exists public.diagnostic_execution_events (
  id bigint generated always as identity primary key,
  execution_id uuid not null,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'execution_started','attempt_started','attempt_succeeded','attempt_failed',
    'execution_succeeded','execution_failed','execution_timed_out'
  )),
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint diagnostic_execution_events_owner_fkey
    foreign key (execution_id, session_id, user_id)
    references public.diagnostic_executions(id, session_id, user_id)
    on delete cascade
);

create table if not exists public.diagnostic_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  execution_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_json jsonb not null,
  evidence_chunk_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint diagnostic_reports_owner_fkey
    foreign key (execution_id, session_id, user_id)
    references public.diagnostic_executions(id, session_id, user_id)
    on delete cascade
);

create index if not exists idx_diagnostic_sessions_user_updated
  on public.diagnostic_sessions(user_id, updated_at desc);
create index if not exists idx_diagnostic_session_evidence_user_session
  on public.diagnostic_session_evidence(user_id, session_id);
create index if not exists idx_diagnostic_executions_user_session
  on public.diagnostic_executions(user_id, session_id, created_at desc);
create index if not exists idx_diagnostic_execution_events_user_execution
  on public.diagnostic_execution_events(user_id, execution_id, created_at);
create index if not exists idx_diagnostic_reports_user_session
  on public.diagnostic_reports(user_id, session_id, created_at desc);

comment on table public.diagnostic_sessions is
  'Server-authoritative Automotive Diagnostic Copilot sessions. Browser clients never receive service-role access.';
comment on table public.diagnostic_session_evidence is
  'User/session evidence associations referencing existing governed source_chunks. Source approval remains authoritative in the evidence pipeline.';
comment on table public.diagnostic_executions is
  'Idempotent bounded Copilot execution ledger. Does not grant grading, publication, release, or assessment authority.';
comment on table public.diagnostic_execution_events is
  'Structured bounded-execution lifecycle events for Copilot observability.';
comment on table public.diagnostic_reports is
  'Advisory Copilot reports. Technician verification remains required and reports are not assessment records.';

alter table public.diagnostic_sessions enable row level security;
alter table public.diagnostic_session_evidence enable row level security;
alter table public.diagnostic_executions enable row level security;
alter table public.diagnostic_execution_events enable row level security;
alter table public.diagnostic_reports enable row level security;

revoke all on table
  public.diagnostic_sessions,
  public.diagnostic_session_evidence,
  public.diagnostic_executions,
  public.diagnostic_execution_events,
  public.diagnostic_reports
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.diagnostic_sessions,
  public.diagnostic_session_evidence,
  public.diagnostic_executions,
  public.diagnostic_reports
to service_role;

grant select, insert on table public.diagnostic_execution_events to service_role;
grant usage, select on sequence public.diagnostic_execution_events_id_seq to service_role;

commit;
