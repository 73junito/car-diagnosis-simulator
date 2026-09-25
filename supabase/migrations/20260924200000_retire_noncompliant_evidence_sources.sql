begin;

-- Retire evidence sources that are not eligible for production question approval.
-- One source was explicitly rejected by the repository rights audit; the other
-- is a synthetic test fixture. Neither may contribute to approved questions.
with retired_sources(id) as (
  values
    ('ijert-starter-performance-testbench-2018'::text),
    ('test-diagnostic-source-001'::text)
)
update public.approved_sources src
   set status = 'retired',
       notes = concat_ws(
         E'\n',
         nullif(src.notes, ''),
         'Retired by evidence-rights hygiene migration; source is not eligible for production question approval.'
       )
  from retired_sources r
 where src.id = r.id
   and src.status <> 'retired';

with retired_sources(id) as (
  values
    ('ijert-starter-performance-testbench-2018'::text),
    ('test-diagnostic-source-001'::text)
)
update public.source_chunks ch
   set status = 'retired',
       approved = false
  from retired_sources r
 where ch.source_id = r.id
   and (ch.status <> 'retired' or ch.approved is distinct from false);

with affected_provenance as (
  select distinct qc.question_provenance_id
  from public.question_citations qc
  where qc.source_id in (
    'ijert-starter-performance-testbench-2018',
    'test-diagnostic-source-001'
  )
)
update public.question_provenance qp
   set status = 'retired',
       notes = concat_ws(
         E'\n',
         nullif(qp.notes, ''),
         'Retired because cited evidence source is not eligible for production approval.'
       )
  from affected_provenance ap
 where qp.id = ap.question_provenance_id
   and qp.status <> 'retired';

commit;
