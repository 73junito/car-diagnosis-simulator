-- Server-backed scenario authoring drafts.
-- Service-role mediated through the production Worker only.
-- Draft persistence does not grant review, publication, training, scoring,
-- assessment, delivery, or release eligibility.

create table if not exists public.scenario_authoring_drafts (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    scenario_key text not null
        check (scenario_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
    title text not null default 'Untitled Scenario'
        check (char_length(title) between 1 and 200),
    payload_json jsonb not null default '{}'::jsonb,
    version integer not null default 1
        check (version > 0),
    status text not null default 'draft'
        check (status = 'draft'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_id, scenario_key)
);

create index if not exists scenario_authoring_drafts_owner_updated_idx
    on public.scenario_authoring_drafts (owner_id, updated_at desc);

alter table public.scenario_authoring_drafts enable row level security;

revoke all on table public.scenario_authoring_drafts
    from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.scenario_authoring_drafts
    to service_role;

comment on table public.scenario_authoring_drafts is
    'Owner-scoped instructor/admin scenario drafts. Worker/service-role mediated only. Draft rows have no publication or assessment eligibility effect.';

comment on column public.scenario_authoring_drafts.payload_json is
    'User-authored scenario draft payload. Never implies review, approval, publication, training delivery, scoring, or assessment eligibility.';
