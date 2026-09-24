begin;

-- Repair legacy provenance rows that still store scenario_questions.id as text.
-- The canonical contract is question_provenance.question_id =
-- scenario_questions.question_id.
update public.question_provenance qp
   set question_id = sq.question_id
  from public.scenario_questions sq
 where qp.question_id = sq.id::text
   and sq.question_id is not null
   and not exists (
       select 1
         from public.question_provenance semantic_qp
        where semantic_qp.question_id = sq.question_id
          and semantic_qp.provenance_version = qp.provenance_version
   );

-- Ensure every semantic scenario question participates in the provenance
-- lifecycle. Missing evidence remains draft and therefore fails closed.
insert into public.question_provenance (
    question_id,
    provenance_version,
    status,
    validation_checklist,
    notes
)select
    sq.question_id,
    1,
    'draft',
    '{}'::jsonb,
    'Backfilled by semantic-ID contract repair; evidence, validation, and review are still required before approval.'
from public.scenario_questions sq
where sq.question_id is not null
  and not exists (
      select 1
        from public.question_provenance qp
       where qp.question_id = sq.question_id
  );

comment on column public.question_provenance.question_id is
    'Stable semantic identifier matching scenario_questions.question_id. Legacy UUID-text rows are tolerated by the API only during migration.';

commit;
