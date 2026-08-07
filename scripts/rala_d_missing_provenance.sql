select
  sq.id as scenario_question_id,
  sq.question_text,
  sq.topic,
  sq.ase_area
from public.scenario_questions sq
left join public.question_provenance qp
  on qp.question_id = sq.id::text
where qp.id is null
order by sq.id;
