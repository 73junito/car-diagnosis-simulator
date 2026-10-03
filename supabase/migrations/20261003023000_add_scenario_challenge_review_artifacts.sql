-- Private durable store for generated scenario-challenge review artifacts.
-- Stores exact answer-bearing draft payloads outside the public repository/runtime.
-- Service-role only. No browser/client access. No eligibility or approval effect.

create table if not exists public.scenario_challenge_review_artifacts (
    id uuid primary key default gen_random_uuid(),
    batch_id integer not null unique check (batch_id between 1 and 4),
    workflow_run_id bigint not null unique check (workflow_run_id > 0),
    workflow_artifact_id bigint not null unique check (workflow_artifact_id > 0),
    workflow_artifact_digest text not null
        check (workflow_artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
    payload_sha256 text not null
        check (payload_sha256 ~ '^[0-9a-f]{64}$'),
    source_commit text not null
        check (source_commit ~ '^[0-9a-f]{40}$'),
    provider text not null default 'ollama-cloud',
    model text not null,
    agent_version text not null,
    question_count integer not null check (question_count = 50),
    status text not null default 'synthetic-draft-review-only'
        check (status = 'synthetic-draft-review-only'),
    payload_text text not null check (length(payload_text) > 0),
    created_at timestamptz not null default now()
);

alter table public.scenario_challenge_review_artifacts enable row level security;

revoke all on table public.scenario_challenge_review_artifacts
    from public, anon, authenticated, service_role;
grant select, insert on table public.scenario_challenge_review_artifacts
    to service_role;

comment on table public.scenario_challenge_review_artifacts is
    'Private service-role-only storage for exact generated scenario-challenge draft artifacts. Rows are review-only and do not grant training, scoring, assessment, citation, evidence, or approval eligibility.';

comment on column public.scenario_challenge_review_artifacts.payload_text is
    'Exact UTF-8 JSON artifact text, including answer-bearing draft content. Stored as text so payload_sha256 can verify the original representation. Never expose through browser/client APIs.';
