begin;

-- Explicit assessment eligibility registry. Intentionally empty by default.
-- Training/content approval MUST NOT populate this table implicitly.
create table if not exists public.assessment_question_eligibility (
  question_id uuid primary key
    references public.scenario_questions(id) on delete cascade,
  scenario_id text not null,
  eligibility_status text not null
    check (eligibility_status in ('approved', 'revoked')),
  approval_record text not null,
  approved_by text not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assessment_question_eligibility enable row level security;
revoke all on public.assessment_question_eligibility from anon, authenticated;
grant select, insert, update on public.assessment_question_eligibility to service_role;

create index if not exists idx_assessment_question_eligibility_scenario_status
  on public.assessment_question_eligibility(scenario_id, eligibility_status);

comment on table public.assessment_question_eligibility is
  'Explicit assessment-only eligibility registry. Empty by default; training approval does not grant assessment eligibility.';

-- Immutable assignment of server-selected questions to a specific attempt.
create table if not exists public.attempt_questions (
  attempt_id uuid not null
    references public.attempts(id) on delete cascade,
  question_id uuid not null
    references public.scenario_questions(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  assigned_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  unique (attempt_id, sequence)
);

alter table public.attempt_questions enable row level security;
revoke all on public.attempt_questions from anon, authenticated;
grant select, insert on public.attempt_questions to service_role;

create index if not exists idx_attempt_questions_attempt_sequence
  on public.attempt_questions(attempt_id, sequence);

comment on table public.attempt_questions is
  'Immutable server-side question assignment for an assessment attempt. Service-role only.';

-- Atomically create an assessment attempt and bind its question set.
-- The function requires BOTH explicit assessment eligibility and the existing
-- provenance/citation approval chain. No eligibility records are seeded here.
create or replace function public.start_assessment_attempt_v1(
  p_user_id uuid,
  p_scenario text,
  p_payload_json jsonb,
  p_question_count integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available integer;
  v_attempt_id uuid;
begin
  if p_user_id is null then
    raise exception 'assessment_user_required';
  end if;

  if p_scenario is null or p_scenario !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'assessment_scenario_invalid';
  end if;

  if p_question_count < 1 or p_question_count > 100 then
    raise exception 'assessment_question_count_invalid';
  end if;

  select count(*)::integer
    into v_available
  from public.scenario_questions sq
  join public.assessment_question_eligibility aqe
    on aqe.question_id = sq.id
   and aqe.scenario_id = sq.scenario_id
   and aqe.eligibility_status = 'approved'
  where sq.scenario_id = p_scenario
    and sq.question_id is not null
    and exists (
      select 1
      from public.question_provenance qp
      join public.citation_validations cv
        on cv.question_provenance_id = qp.id
       and cv.result = 'valid'
      where qp.question_id = sq.question_id
        and qp.status = 'approved'
        and exists (
          select 1 from public.question_citations qa
          where qa.question_provenance_id = qp.id
            and qa.role = 'supports-answer'
        )
        and exists (
          select 1 from public.question_citations qe
          where qe.question_provenance_id = qp.id
            and qe.role = 'supports-explanation'
        )
        and not exists (
          select 1
          from public.question_citations qc
          left join public.approved_sources src on src.id = qc.source_id
          left join public.source_chunks ch on ch.chunk_id = qc.chunk_id
          where qc.question_provenance_id = qp.id
            and (
              src.id is null or src.status <> 'approved'
              or ch.chunk_id is null or ch.status <> 'approved'
              or ch.approved is distinct from true
            )
        )
    );

  if v_available < p_question_count then
    raise exception 'assessment_bank_not_ready:%/%', v_available, p_question_count;
  end if;

  insert into public.attempts (
    user_id,
    scenario,
    delivery_mode,
    workflow_type,
    status,
    payload_json
  ) values (
    p_user_id,
    p_scenario,
    'independent_non_proctored_assessment',
    'scenario_diagnostic',
    'active',
    coalesce(p_payload_json, '{}'::jsonb)
  )
  returning id into v_attempt_id;

  with eligible as (
    select sq.id, random() as random_order
    from public.scenario_questions sq
    join public.assessment_question_eligibility aqe
      on aqe.question_id = sq.id
     and aqe.scenario_id = sq.scenario_id
     and aqe.eligibility_status = 'approved'
    where sq.scenario_id = p_scenario
      and sq.question_id is not null
      and exists (
        select 1
        from public.question_provenance qp
        join public.citation_validations cv
          on cv.question_provenance_id = qp.id
         and cv.result = 'valid'
        where qp.question_id = sq.question_id
          and qp.status = 'approved'
          and exists (
            select 1 from public.question_citations qa
            where qa.question_provenance_id = qp.id
              and qa.role = 'supports-answer'
          )
          and exists (
            select 1 from public.question_citations qe
            where qe.question_provenance_id = qp.id
              and qe.role = 'supports-explanation'
          )
          and not exists (
            select 1
            from public.question_citations qc
            left join public.approved_sources src on src.id = qc.source_id
            left join public.source_chunks ch on ch.chunk_id = qc.chunk_id
            where qc.question_provenance_id = qp.id
              and (
                src.id is null or src.status <> 'approved'
                or ch.chunk_id is null or ch.status <> 'approved'
                or ch.approved is distinct from true
              )
          )
      )
    order by random_order
    limit p_question_count
  ), numbered as (
    select id, row_number() over (order by random_order)::integer as sequence
    from eligible
  )
  insert into public.attempt_questions(attempt_id, question_id, sequence)
  select v_attempt_id, id, sequence
  from numbered;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_assessment_attempt_v1(uuid, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.start_assessment_attempt_v1(uuid, text, jsonb, integer) to service_role;

comment on function public.start_assessment_attempt_v1(uuid, text, jsonb, integer) is
  'Atomically starts an assessment attempt only from explicitly assessment-eligible and evidence-approved questions.';

commit;