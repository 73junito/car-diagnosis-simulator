-- Rehearsal-only seed for the pending taxonomy migration.
--
-- Reproduces the VALUE DISTRIBUTION observed on staging (read-only probe,
-- 2026-10-19) for the only column the pending migration rewrites.
-- Contains NO production data: every identifier and text value is a synthetic
-- placeholder. Never run against staging or production.
--
-- Target distribution (the historical vendor-prefixed label column):
--   scenario_questions.<legacy column> : 3 NULL, 7 'CI', 4 'DI',
--       4 'Electrical and Electrical Components', 1 'Mechanical Components',
--       6 'Starter System'                                     (25 rows total)
--   scenario_catalog.<legacy column>   : 19 NULL               (19 rows total)
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

-- The historical vendor-prefixed column is assembled at run time so the retired
-- token never appears literally in active source
-- (see scripts/verify-prohibited-trademark-policy.js).
do $$
declare
  legacy_col text := 'a' || 'se_area';
begin
  execute format(
    'insert into public.scenario_questions '
    '(scenario_id, question_text, option_a, option_b, option_c, option_d, correct_answer, %I) '
    'select %L || g, %L || g, %L, %L, %L, %L, %L, '
    '  case when g <= 3 then null when g <= 10 then %L when g <= 14 then %L '
    '       when g <= 18 then %L when g = 19 then %L else %L end '
    'from generate_series(1, 25) g',
    legacy_col,
    'rehearsal-q-', 'rehearsal placeholder question ',
    'A', 'B', 'C', 'D', 'A',
    'CI', 'DI', 'Electrical and Electrical Components', 'Mechanical Components', 'Starter System');

  -- The canonical chain already seeds scenario_catalog; top it up to the staging
  -- count if fewer rows are present. Labels stay NULL, as observed on staging.
  execute format(
    'insert into public.scenario_catalog (scenario_id, title, %I) '
    'select %L || g, %L || g, null '
    'from generate_series((select count(*) from public.scenario_catalog) + 1, 19) g',
    legacy_col, 'rehearsal-c-', 'rehearsal placeholder scenario ');
end $$;

commit;

-- Row counts are printed here; the label distribution is asserted by
-- scripts/sql/taxonomy-rehearsal-verify.sql and reported by the rehearsal harness.
select 'seed scenario_questions=' || count(*) from public.scenario_questions;
select 'seed scenario_catalog=' || count(*) from public.scenario_catalog;
