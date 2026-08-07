with per_question as (
  select
    qp.question_id,
    qp.provenance_version,
    count(*) filter (where qc.role = 'supports-answer') as answer_citations,
    count(*) filter (where qc.role = 'supports-explanation') as explanation_citations,
    count(*) filter (
      where qc.id is not null
        and sc.chunk_id is not null
        and s.id is not null
        and sc.source_id = qc.source_id
        and s.status = 'approved'
        and sc.status = 'approved'
        and sc.approved is true
    ) as resolved_citations,
    count(qc.id) as total_citations
  from public.question_provenance qp
  left join public.question_citations qc
    on qc.question_provenance_id = qp.id
  left join public.source_chunks sc
    on sc.chunk_id = qc.chunk_id
  left join public.approved_sources s
    on s.id = qc.source_id
  group by qp.question_id, qp.provenance_version
)
select
  question_id,
  provenance_version,
  total_citations,
  resolved_citations,
  answer_citations,
  explanation_citations,
  case
    when total_citations = 0 then 'not_grounded'
    when answer_citations = 0 or explanation_citations = 0 then 'missing_required_roles'
    when resolved_citations < total_citations then 'partially_resolved'
    else 'traceable_ready'
  end as traceability_status
from per_question
order by traceability_status, question_id, provenance_version;
