-- Vendor-neutral competency foundation for TorqueMind.
-- Additive only: establishes new competency taxonomy and columns.
--
-- This migration establishes:
-- 1. Competency taxonomy (TorqueMind-owned semantic identifiers)
-- 2. Program classification mapping (institutional cross-reference)
-- 3. New competency_area_id columns on scenario tables
-- 4. Row-level security for institutional data
--
-- Migration Strategy: Additive. No destructive operations.
-- New competency_area_id columns are nullable during backfill phase.
--
-- Approved Decisions:
-- - DECISION 1: Use TorqueMind semantic competency codes (ENGR, HVAC, ELEC, etc.)
-- - DECISION 2: Keep program/CIP classification separate via competency_to_program_map
-- - DECISION 3: Additive schema only; existing source columns remain unchanged during this foundation migration
-- - DECISION 4: Student readiness computed server-side (API, not database view)

-- =============================================================================
-- STEP 1: Create competency_areas table
-- =============================================================================
-- Represents TorqueMind-owned instructional competency taxonomy.
-- These are internal semantic identifiers, not certification or compliance codes.

create table if not exists public.competency_areas (
    id uuid primary key default gen_random_uuid(),
    competency_code text not null unique,
    competency_name text not null,
    description text,
    status text not null default 'active' check (status in ('active', 'deprecated', 'retired')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.competency_areas is
    'TorqueMind semantic competency taxonomy. '
    'Internal skill/knowledge domains independent of institutional '
    'program classifications.';

comment on column public.competency_areas.competency_code is
    'Unique internal identifier (e.g., ENGR, HVAC, ELEC, PERF). '
    'Not derived from external certification systems.';

alter table public.competency_areas enable row level security;

-- =============================================================================
-- STEP 2: Create competency_to_program_map table
-- =============================================================================
-- Maps TorqueMind competencies to institutional program classifications.
-- Enables multi-jurisdiction, multi-program, multi-classification-system support.
-- Keeps institutional requirements separate from competency taxonomy.

create table if not exists public.competency_to_program_map (
    id uuid primary key default gen_random_uuid(),
    competency_area_id uuid not null
        constraint competency_to_program_map_competency_area_id_fkey
        references public.competency_areas(id)
        on delete restrict,
    jurisdiction_code text not null,
    authority_name text not null,
    classification_system text not null,
    classification_code text not null,
    classification_name text,
    program_name text,
    notes text,
    created_at timestamptz not null default now(),

    constraint competency_program_map_unique
        unique (
            competency_area_id,
            jurisdiction_code,
            authority_name,
            classification_system,
            classification_code
        )
);

comment on table public.competency_to_program_map is
    'Cross-reference between TorqueMind competencies and external '
    'program classifications (e.g., KBOR CIP 47.0604 for Kansas Automotive Technology). '
    'Enables institutional compliance tracking without embedding program '
    'specifics into competency taxonomy.';

alter table public.competency_to_program_map enable row level security;

create index if not exists idx_competency_program_map_competency_id
    on public.competency_to_program_map(competency_area_id);

create index if not exists idx_competency_program_map_jurisdiction
    on public.competency_to_program_map(jurisdiction_code, authority_name);

-- =============================================================================
-- STEP 3: Add competency_area_id columns to core scenario tables
-- =============================================================================
-- Nullable during backfill phase. Will be populated via controlled mapping script.

alter table public.scenario_catalog
    add column if not exists competency_area_id uuid
        constraint scenario_catalog_competency_area_id_fkey
        references public.competency_areas(id);

comment on column public.scenario_catalog.competency_area_id is
    'Foreign key to competency_areas. Populated during backfill phase. '
    'Provides the TorqueMind-owned competency taxonomy relationship.';

alter table public.scenario_questions
    add column if not exists competency_area_id uuid
        constraint scenario_questions_competency_area_id_fkey
        references public.competency_areas(id);

comment on column public.scenario_questions.competency_area_id is
    'Foreign key to competency_areas. Populated during backfill phase. '
    'Provides the TorqueMind-owned competency taxonomy relationship.';

-- =============================================================================
-- STEP 4: Create indexes for performance during backfill and queries
-- =============================================================================

create index if not exists idx_scenario_catalog_competency_area_id
    on public.scenario_catalog(competency_area_id)
    where competency_area_id is not null;

create index if not exists idx_scenario_questions_competency_area_id
    on public.scenario_questions(competency_area_id)
    where competency_area_id is not null;

-- =============================================================================
-- STEP 5: Student reporting deferred to server-side API
-- =============================================================================
-- Database views CANNOT be used to expose student readiness because:
--   1. attempt_answers.is_correct is service-role protected (RLS enforced)
--   2. Browser clients (anon/authenticated) have zero SELECT privilege on it
--   3. A security_invoker view inherits the underlying table's RLS/grants
--   4. No browser client can execute a view that requires service_role access
--
-- SOLUTION: Compute readiness server-side via trusted API with service-role
-- credentials. The API will:
--   - Verify caller identity
--   - Query attempt_answers with service-role access
--   - Filter results to show only the authenticated student's data
--   - Return sanitized recommendation fields (no is_correct, no audit data)
--
-- Recommendation data will be delivered via /api/student-recommendations
-- served by trusted server code, not by PostgREST view access.

-- =============================================================================
-- STEP 6: Establish RLS security model (placeholder for future policy)
-- =============================================================================
-- Row-level security is enabled on competency tables.
-- Access policies will be defined based on institutional requirements.

-- Example policy structure (not enforced yet):
-- - Instructors can view all competency mappings for their school
-- - Students can only see readiness for their own progress
-- - System admins can manage competency definitions

-- END OF MIGRATION
-- =============================================================================
--
-- NEXT STEPS (performed separately in backfill script):
-- 1. Populate competency_areas with semantic taxonomy (ENGR, HVAC, ELEC, etc.)
-- 2. Create competency_to_program_map entries for Kansas CIP 47.0604
-- 3. Backfill scenario_catalog.competency_area_id using the approved semantic mapping
-- 4. Backfill scenario_questions.competency_area_id using the approved semantic mapping
-- 5. Validate backfill coverage and identify ambiguous/unmapped values
-- 6. Manual review of unmapped values before automatic assignment
--
-- SUBSEQUENT PHASES:
-- Phase 2.2: API refactoring to query competency_area_id via FK relations
--   - Modify api/scenario-questions-approved.js to use competency_area?.competency_code
--   - Modify worker/routes/scenario-questions-approved.js to use same FK pattern
--   - Return competency_code in public payloads
--
-- Phase 2.3: Server-side recommendation API
--   - Create /api/student-recommendations endpoint (trusted, service-role access)
--   - Query attempt_answers.is_correct (allowed via service-role only)
--   - Return sanitized recommendation fields for authenticated user
--   - Replace dashboard REST call from PostgREST view to trusted API
--
-- CONSTRAINTS:
-- - attempt_answers.is_correct is service-role protected (not exposed to browser)
-- - Recommendation data must be computed server-side, not via database view
-- - Existing source columns remain unchanged during this additive foundation migration
-- - All new columns and tables are nullable/additive (rollback-safe)
-- - Migration is IDEMPOTENT (safe to re-run)
