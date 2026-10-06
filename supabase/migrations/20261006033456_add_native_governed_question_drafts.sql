-- Private durable store for one native governed question draft per lifecycle run.
-- Stores exact answer-bearing payloads outside public learner-facing question tables.
-- Service-role only. No browser/client access. No review, approval, or eligibility effect.

create table if not exists public.native_governed_question_drafts (
    id uuid primary key default gen_random_uuid(),
    governed_run_id text not null unique
        check (governed_run_id ~ '^[A-Za-z0-9._:-]+$'),
    question_id text not null unique
        check (question_id ~ '^[a-z0-9-]+$'),
    scenario_id text not null
        check (scenario_id ~ '^[a-z0-9-]+$'),
    workflow_run_id bigint not null check (workflow_run_id > 0),
    workflow_run_attempt integer not null check (workflow_run_attempt > 0),
    source_commit text not null
        check (source_commit ~ '^[0-9a-f]{40}$'),
    provider text not null default 'ollama-cloud',
    model text not null,
    agent_version text not null,
    payload_sha256 text not null
        check (payload_sha256 ~ '^[0-9a-f]{64}$'),
    status text not null default 'drafted-unreviewed'
        check (status = 'drafted-unreviewed'),
    payload_text text not null check (length(payload_text) > 0),
    created_at timestamptz not null default now(),
    unique (workflow_run_id, workflow_run_attempt)
);

alter table public.native_governed_question_drafts enable row level security;

revoke all on table public.native_governed_question_drafts
    from public, anon, authenticated, service_role;
grant select, insert on table public.native_governed_question_drafts
    to service_role;

comment on table public.native_governed_question_drafts is
    'Private service-role-only storage for exact native governed question drafts. Rows remain unreviewed and do not grant citation, technical-review, instructional-review, approval, training, scoring, assessment, delivery, API, or release eligibility.';

comment on column public.native_governed_question_drafts.payload_text is
    'Exact UTF-8 JSON artifact text including question text, answer options, keyed answer, explanation, and candidate citations. Never expose through browser/client APIs.';

comment on column public.native_governed_question_drafts.governed_run_id is
    'Governed orchestration run initialized at drafted. The presence of this row does not imply any later governance state.';
