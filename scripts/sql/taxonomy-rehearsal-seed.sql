-- Rehearsal-only seed for the pending taxonomy migration.
--
-- Reproduces the VALUE DISTRIBUTION observed on staging (read-only probe,
-- 2026-10-19) for the only column the pending migration rewrites.
-- Contains NO production data: every identifier and text value is a synthetic
-- placeholder. Never run against staging or production.
--
-- Target distribution:
--   scenario_questions.ase_area : 3 NULL, 7 'CI', 4 'DI',
--       4 'Electrical and Electrical Components', 1 'Mechanical Components',
--       6 'Starter System'                                     (25 rows total)
--   scenario_catalog.ase_area   : 19 NULL                      (19 rows total)
--
-- No rows are deleted, so inbound foreign keys (attempt_answers, attempt_questions,
-- assessment_question_eligibility, scenario_curriculum_mappings,
-- scenario_dataset_mappings, syllabus_scenarios, restricted_dataset_archives)
-- are never violated.

begin;

-- Preconditions are asserted so a mis-seeded rehearsal fails loudly instead of
-- silently producing misleading PASS results.
do $$
declare n int;
begin
  select count(*) into n from public.scenario_questions;
  if n <> 0 then
    raise exception 'seed precondition failed: scenario_questions has % row(s), expected 0', n;
  end if;
end $$;

insert into public.scenario_questions
  (scenario_id, question_text, option_a, option_b, option_c, option_d, correct_answer, ase_area)
select 'rehearsal-q-' || g,
       'rehearsal placeholder question ' || g,
       'A', 'B', 'C', 'D', 'A',
       case
         when g <= 3  then null
         when g <= 10 then 'CI'
         when g <= 14 then 'DI'
         when g <= 18 then 'Electrical and Electrical Components'
         when g = 19  then 'Mechanical Components'
         else 'Starter System'
       end
from generate_series(1, 25) g;

-- The canonical chain already seeds scenario_catalog; top it up to the staging
-- count if fewer rows are present. Labels stay NULL, as observed on staging.
insert into public.scenario_catalog (scenario_id, title, ase_area)
select 'rehearsal-c-' || g, 'rehearsal placeholder scenario ' || g, null
from generate_series((select count(*) from public.scenario_catalog) + 1, 19) g;

commit;

select 'seed scenario_questions=' || count(*) from public.scenario_questions;
select 'seed scenario_catalog=' || count(*) from public.scenario_catalog;
select 'seed question_labels=' || coalesce(ase_area, '<NULL>') || ' x' || count(*)
from public.scenario_questions group by ase_area order by 1;
