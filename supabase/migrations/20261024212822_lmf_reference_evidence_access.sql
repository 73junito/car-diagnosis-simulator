-- Draft LMF training reference evidence storage: deny client writes, owner-scoped reads.
-- Server must verify JWT ownership, sign with server-only secret, and append atomically.
create table if not exists public.lmf_reference_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 model_ref text not null check (model_ref = '/data/circuit-templates/12v-starting-system-v2.json'),
 model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
 evidence_role text not null default 'training-reference-only' check (evidence_role = 'training-reference-only'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 unique(id, owner_id),
 check (expires_at > created_at)
);
create table if not exists public.lmf_reference_events (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.lmf_reference_sessions(id) on delete cascade,
 owner_id uuid not null,
 sequence_number bigint not null check (sequence_number > 0),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 previous_hash text check (previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$'),
 event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
 event_signature text not null check (event_signature ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 foreign key(session_id,owner_id) references public.lmf_reference_sessions(id,owner_id) on delete cascade,
 unique(session_id,sequence_number),
 unique(session_id,event_hash)
);
create index if not exists lmf_reference_sessions_owner_idx on public.lmf_reference_sessions(owner_id,expires_at);
create index if not exists lmf_reference_events_session_idx on public.lmf_reference_events(session_id,sequence_number);
alter table public.lmf_reference_sessions enable row level security;
alter table public.lmf_reference_events enable row level security;
revoke all on public.lmf_reference_sessions from anon,authenticated;
revoke all on public.lmf_reference_events from anon,authenticated;
grant select on public.lmf_reference_sessions to authenticated;
grant select on public.lmf_reference_events to authenticated;
create policy lmf_reference_sessions_select_owner on public.lmf_reference_sessions
 for select to authenticated using (owner_id=(select auth.uid()) and expires_at>now());
create policy lmf_reference_events_select_owner on public.lmf_reference_events
 for select to authenticated using (owner_id=(select auth.uid()) and exists (
 select 1 from public.lmf_reference_sessions s where s.id=session_id and s.owner_id=(select auth.uid()) and s.expires_at>now()
 ));
-- No client INSERT/UPDATE/DELETE policy. Trusted server service-role writes only.
-- The server must serialize per-session append writes and enforce previous-hash continuity.
-- Privileged retention worker deletes expired sessions, cascading to events.
