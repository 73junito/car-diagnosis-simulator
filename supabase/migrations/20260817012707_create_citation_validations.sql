-- Create citation_validations table for deterministic citation verification
-- This table stores actual validator output, never manufactured evidence.
create table if not exists public.citation_validations (
  id uuid primary key default gen_random_uuid(),
  question_provenance_id uuid not null
    references public.question_provenance(id) on delete cascade,
  validator_version text not null,
  validation_method text not null,
  source_hashes_verified boolean not null,
  excerpts_verified boolean not null,
  urls_verified boolean not null,
  result text not null check (result in ('valid', 'invalid')),
  errors jsonb not null default '[]'::jsonb,
  validated_at timestamptz not null default now(),
  unique (question_provenance_id, validator_version)
);

-- Enable RLS
alter table public.citation_validations enable row level security;

-- Service-role only access: Citation validation is a server-side function
-- Only the backend validator (service_role) writes validation evidence
-- Only the grading endpoint (service_role) reads validation results
-- Browser clients never access citation_validations directly
grant select, insert, update on public.citation_validations to service_role;

-- Default deny: RLS blocks all access for anon and authenticated
-- No policies needed; service_role bypasses RLS automatically
comment on table public.citation_validations is
  'Citation validator evidence. Service-role only. '
  'Stores validation results for each question_provenance: source hash verification, '
  'excerpt comparison, URL accessibility check. '
  'Browser clients access only indirectly via sanitized /api/scenario-questions-approved endpoint.';

-- DO NOT AUTO-POPULATE: Validation records must be created by an actual validator
-- that imports real evidence, not manufactured true/false values.
-- Validators will call INSERT with actual verification results from executing:
-- 1. Source hash verification (crypto/integrity check)
-- 2. Excerpt verification (text content comparison)
-- 3. URL verification (accessibility/HTTP check)
--
-- Until a validator runs and produces evidence, citation_validations is empty.
-- This ensures fail-closed behavior: missing record = no valid citations served.
