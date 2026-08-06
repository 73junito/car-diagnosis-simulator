-- Migration: approved sources and large chunks
-- Generated: 2026-08-05

create table if not exists public.approved_sources (
    id text primary key,
    title text not null,
    authors jsonb not null default '[]'::jsonb,
    publisher text,
    publication_year integer,
    license jsonb not null default '{}'::jsonb,
    original_filename text,
    storage_path text not null,
    checksum text not null,
    checksum_algorithm text not null default 'sha256',
    language text not null default 'en',
    version integer not null default 1,
    status text not null check (
        status in (
            'draft',
            'source-linked',
            'validated',
            'approved',
            'retired',
            'superseded'
        )
    ),
    superseded_by text references public.approved_sources(id),
    uploaded_by uuid,
    uploaded_at timestamptz not null default now(),
    license_reviewed_by uuid,
    license_reviewed_at timestamptz,
    notes text,
    unique (checksum)
);

create table if not exists public.source_chunks (
    chunk_id text primary key,
    source_id text not null references public.approved_sources(id) on delete restrict,
    source_version integer not null,
    title text,
    section text,
    page_start integer,
    page_end integer,
    locator text,
    text_excerpt text not null,
    token_count integer not null,
    overlap_before_tokens integer not null default 0,
    overlap_after_tokens integer not null default 0,
    text_hash text not null,
    language text not null default 'en',
    status text not null check (
        status in (
            'draft',
            'source-linked',
            'validated',
            'approved',
            'retired',
            'superseded'
        )
    ),
    approved boolean not null default false,
    created_at timestamptz not null default now(),
    approved_by uuid,
    approved_at timestamptz,
    check (page_start is not null or section is not null or locator is not null),
    unique (source_id, text_hash)
);

create table if not exists public.question_provenance (
    id uuid primary key default gen_random_uuid(),
    question_id text not null,
    provenance_version integer not null default 1,
    status text not null check (
        status in (
            'draft',
            'source-linked',
            'validated',
            'approved',
            'retired',
            'superseded'
        )
    ),
    validation_checklist jsonb not null default '{}'::jsonb,
    technical_reviewer_id uuid,
    technical_reviewed_at timestamptz,
    instructional_reviewer_id uuid,
    instructional_reviewed_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    notes text,
    unique (question_id, provenance_version)
);

create table if not exists public.question_citations (
    id uuid primary key default gen_random_uuid(),
    question_provenance_id uuid not null references public.question_provenance(id) on delete cascade,
    source_id text not null references public.approved_sources(id) on delete restrict,
    chunk_id text not null references public.source_chunks(chunk_id) on delete restrict,
    locator text,
    quote text,
    role text not null check (
        role in (
            'supports-question',
            'supports-answer',
            'supports-explanation',
            'supports-next-step',
            'supports-ase-concept'
        )
    )
);

create table if not exists public.provenance_audit (
    audit_id uuid primary key default gen_random_uuid(),
    entity_type text not null,
    entity_id text not null,
    action text not null,
    performed_by uuid,
    performed_at timestamptz not null default now(),
    details jsonb not null default '{}'::jsonb,
    signature text
);

-- Note: RLS policies for audit table should restrict inserts to authorized reviewer roles only.

-- Enable row level security and add policies restricting who can insert/update/select.
alter table public.approved_sources enable row level security;
alter table public.source_chunks enable row level security;
alter table public.question_provenance enable row level security;
alter table public.question_citations enable row level security;
alter table public.provenance_audit enable row level security;

-- Create minimal auth.uid() compatibility shim for non-Supabase Postgres environments.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
security definer
as $$
    select (current_setting('auth.uid', true))::uuid;
$$;

-- Helper: only allow operations by users with reviewer/admin roles
-- Assumes a `public.profiles` table with `id` and `role` columns.

-- Policies for approved_sources
create policy approved_sources_select on public.approved_sources
    for select
    to public
    using (true);

-- Helper functions for role checks. These are stable, security-definer functions
-- and should be adapted if your auth/profile schema differs.
create or replace function public.is_provenance_reviewer()
returns boolean
language sql
stable
security definer
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
            and p.role in ('admin','technical_reviewer','instructional_reviewer')
    );
$$;

create or replace function public.is_provenance_admin()
returns boolean
language sql
stable
security definer
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
            and p.role = 'admin'
    );
$$;

create policy approved_sources_insert_reviewers on public.approved_sources
    for insert
    to authenticated
    with check ( public.is_provenance_reviewer() );

create policy approved_sources_update_reviewers on public.approved_sources
    for update
    to authenticated
    using ( public.is_provenance_reviewer() )
    with check ( public.is_provenance_reviewer() );

-- Prevent deletes except by admin
create policy approved_sources_delete_admin on public.approved_sources
    for delete
    to authenticated
    using ( public.is_provenance_admin() );

-- Policies for source_chunks
create policy source_chunks_select on public.source_chunks
    for select
    to public
    using (true);

create policy source_chunks_insert_reviewers on public.source_chunks
    for insert
    to authenticated
    with check ( public.is_provenance_reviewer() );

create policy source_chunks_update_reviewers on public.source_chunks
    for update
    to authenticated
    using ( public.is_provenance_reviewer() )
    with check ( public.is_provenance_reviewer() );

create policy source_chunks_delete_admin on public.source_chunks
    for delete
    to authenticated
    using ( public.is_provenance_admin() );

-- Policies for question_provenance
create policy question_provenance_select on public.question_provenance
    for select
    to public
    using (true);

create policy question_provenance_insert_reviewers on public.question_provenance
    for insert
    to authenticated
    with check ( public.is_provenance_reviewer() );

create policy question_provenance_update_reviewers on public.question_provenance
    for update
    to authenticated
    using ( public.is_provenance_reviewer() )
    with check ( public.is_provenance_reviewer() );

create policy question_provenance_delete_admin on public.question_provenance
    for delete
    to authenticated
    using ( public.is_provenance_admin() );

-- Policies for question_citations
create policy question_citations_select on public.question_citations
    for select
    to public
    using (true);

create policy question_citations_insert_reviewers on public.question_citations
    for insert
    to authenticated
    with check ( public.is_provenance_reviewer() );

create policy question_citations_update_reviewers on public.question_citations
    for update
    to authenticated
    using ( public.is_provenance_reviewer() )
    with check ( public.is_provenance_reviewer() );

create policy question_citations_delete_admin on public.question_citations
    for delete
    to authenticated
    using ( public.is_provenance_admin() );

-- Policies for provenance_audit: append-only insert allowed by reviewers/admins; no update/delete policies.
create policy provenance_audit_insert_reviewers on public.provenance_audit
    for insert
    to authenticated
    with check ( public.is_provenance_reviewer() );

create policy provenance_audit_select_public on public.provenance_audit
    for select
    to public
    using (true);

-- ==================================================================
-- Triggers: enforce allowed status transitions and approval constraints
-- ==================================================================

-- Function to prevent invalid transitions for question_provenance
create or replace function public.fn_check_question_provenance_status()
returns trigger language plpgsql as $$
declare
    old_status text := NULL;
    new_status text := NULL;
    cnt_answer_cit int := 0;
    cnt_expl_cit int := 0;
    chk jsonb := '{}'::jsonb;
begin
    if TG_OP = 'UPDATE' then
        old_status := OLD.status;
    end if;
    new_status := NEW.status;

    -- Disallow direct draft -> approved
    if (old_status is null or old_status = 'draft') and new_status = 'approved' then
        raise exception 'Invalid provenance transition: draft -> approved is not allowed';
    end if;

    -- Only allow approved if checklist flags true and citations exist and referenced chunks/sources are approved
    if new_status = 'approved' then
        -- validation checklist checks
        chk := coalesce(NEW.validation_checklist, '{}'::jsonb);
        if not (chk->>'answer_verified' = 'true' and chk->>'explanation_verified' = 'true' and chk->>'citation_matches_excerpt' = 'true' and chk->>'license_ok' = 'true') then
            raise exception 'Cannot approve: validation checklist incomplete';
        end if;

        select count(*) into cnt_answer_cit from public.question_citations qc where qc.question_provenance_id = NEW.id and qc.role = 'supports-answer';
        select count(*) into cnt_expl_cit from public.question_citations qc where qc.question_provenance_id = NEW.id and qc.role = 'supports-explanation';

        if cnt_answer_cit < 1 or cnt_expl_cit < 1 then
            raise exception 'Cannot approve: missing required citations (answer/explanation)';
        end if;

        -- verify cited chunks and sources are approved
        if exists (
            select 1
            from public.question_citations qc
            join public.source_chunks sc on sc.chunk_id = qc.chunk_id
            join public.approved_sources s on s.id = sc.source_id
            where qc.question_provenance_id = NEW.id
                and (sc.approved is not true or sc.status <> 'approved' or s.status <> 'approved')
        ) then
            raise exception 'Cannot approve: one or more cited chunks/sources are not approved';
        end if;
    end if;

    return NEW;
end;
$$;

create trigger trg_check_question_provenance_status
    before insert or update on public.question_provenance
    for each row execute function public.fn_check_question_provenance_status();

-- Function to prevent inserting approved source or chunk without proper transitions
create or replace function public.fn_check_source_chunk_status()
returns trigger language plpgsql as $$
begin
    if TG_OP = 'INSERT' then
        if NEW.status = 'approved' then
            raise exception 'Cannot insert source/chunk with status = approved directly';
        end if;
    end if;
    if TG_OP = 'UPDATE' then
        if (OLD.status = 'draft' or OLD.status = 'source-linked') and NEW.status = 'approved' then
            raise exception 'Invalid transition to approved; must be validated first';
        end if;
    end if;
    return NEW;
end;
$$;

create trigger trg_check_source_chunks_status
    before insert or update on public.source_chunks
    for each row execute function public.fn_check_source_chunk_status();

create trigger trg_check_approved_sources_status
    before insert or update on public.approved_sources
    for each row execute function public.fn_check_source_chunk_status();

