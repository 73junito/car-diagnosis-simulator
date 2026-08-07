select distinct
  qc.source_id,
  s.title,
  s.status,
  s.storage_path
from public.question_citations qc
left join public.approved_sources s
  on s.id = qc.source_id
where s.id is null or s.status <> 'approved'
order by qc.source_id;
