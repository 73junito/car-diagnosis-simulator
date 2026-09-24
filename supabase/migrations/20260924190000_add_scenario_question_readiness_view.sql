begin;

create or replace view public.scenario_question_readiness
with (security_invoker = true)
as
with provenance_gate as (
  select
    qp.question_id,
    bool_or(qp.status = 'approved'
      and cv.result = 'valid'
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
    ) as provenance_valid
  from public.question_provenance qp
  left join public.citation_validations cv
    on cv.question_provenance_id = qp.id
  group by qp.question_id
),
citation_gate as (
  select
    qp.question_id,
    bool_and(src.status = 'approved'
      and ch.status = 'approved'
      and ch.approved = true) as citations_approved
  from public.question_provenance qp
  join public.question_citations qc
    on qc.question_provenance_id = qp.id
  join public.approved_sources src on src.id = qc.source_id
  join public.source_chunks ch on ch.chunk_id = qc.chunk_id
  group by qp.question_id
)
select
  sq.scenario_id,
  count(*)::integer as total_questions,
  count(*) filter (where sq.question_id is not null)::integer as semantic_question_ids,
  count(*) filter (
    where coalesce(pg.provenance_valid, false)
      and coalesce(cg.citations_approved, false)
  )::integer as approved_questions,
  20::integer as required_questions,
  greatest(
    0,
    20 - count(*) filter (
      where coalesce(pg.provenance_valid, false)
        and coalesce(cg.citations_approved, false)
    )
  )::integer as gap_to_20,
  count(*) filter (
    where coalesce(pg.provenance_valid, false)
      and coalesce(cg.citations_approved, false)
  ) >= 20 as ready
from public.scenario_questions sq
left join provenance_gate pg on pg.question_id = sq.question_id
left join citation_gate cg on cg.question_id = sq.question_id
group by sq.scenario_id;

revoke all on public.scenario_question_readiness from anon, authenticated;
grant select on public.scenario_question_readiness to service_role;

comment on view public.scenario_question_readiness is
  'Read-only service-role readiness summary for 20-question scenario banks.';

commit;
