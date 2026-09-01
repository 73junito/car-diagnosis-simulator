select
  sq.id as scenario_question_uuid,
  sq.question_id,
  sq.question_text,
  sq.topic,
  sq.ase_area
from public.scenario_questions sq
left join public.question_provenance qp
  on qp.question_id = sq.question_id
where sq.question_id is null
   or qp.id is null
order by sq.question_id nulls first, sq.id;
