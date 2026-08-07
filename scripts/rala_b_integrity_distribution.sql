with chain as (
  select
    case
      when qc.id is null then 'no_citation_row'
      when sc.chunk_id is null then 'missing_chunk'
      when s.id is null then 'missing_source'
      when sc.source_id <> qc.source_id then 'source_chunk_mismatch'
      when s.status <> 'approved' then 'source_not_approved'
      when sc.status <> 'approved' or sc.approved is not true then 'chunk_not_approved'
      else 'resolved'
    end as citation_integrity
  from public.question_provenance qp
  left join public.question_citations qc
    on qc.question_provenance_id = qp.id
  left join public.source_chunks sc
    on sc.chunk_id = qc.chunk_id
  left join public.approved_sources s
    on s.id = qc.source_id
)
select citation_integrity, count(*) as rows
from chain
group by citation_integrity
order by rows desc, citation_integrity;
