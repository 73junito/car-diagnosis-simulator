begin;

alter table public.scenario_questions
    add column if not exists question_id text;

create unique index if not exists
    scenario_questions_question_id_unique_idx
    on public.scenario_questions (question_id)
    where question_id is not null;

-- Correct two evidence-backed question strings before exact semantic mapping.
-- UUID and current text predicates prevent unintended content changes.
update public.scenario_questions
   set question_text =
       'When should the starter S-terminal be checked for 12 volts?'
 where id = '92f35d83-eae2-4325-bb80-102948311dd3'
   and scenario_id = 'no-crank'
   and question_text =
       'When should the starter S-terminal be checkedfor 12 volts?';

update public.scenario_questions
   set question_text =
       'Which BCM power-mode value should be verified during the cited no-crank diagnosis?'
 where id = 'ca6dad45-c071-4bad-82b4-266b5b303e30'
   and scenario_id = 'no-crank'
   and question_text =
       'Which BCM power-mode value should be verifiedduring the cited no-crank diagnosis?';

with semantic_map(question_id, question_text) as (
    values
      ('no-crank-battery-cca-01',
       'Which battery measurement is specifically recorded with battery voltage?'),
      ('no-crank-battery-health-01',
       'Which battery information should be recorded early in a no-crank diagnosis?'),
      ('no-crank-battery-health-02',
       'Before blaming the starter for a no-crank complaint, which component condition should be verified?'),
      ('no-crank-clutch-01',
       'What pedal must be fully depressed before starting the cited manual-transmission vehicle?'),
      ('no-crank-control-path-01',
       'Which BCM power-mode value should be verified during the cited no-crank diagnosis?'),
      ('no-crank-crank-request-01',
       'Which ECM data parameter confirms that a crank request is present?'),
      ('no-crank-crank-request-02',
       'Active Crank Request and Crank Relay Command confirm what?'),
      ('no-crank-diagnostic-sequence-01',
       'Which sequence best follows the cited electronic no-crank checks?'),
      ('no-crank-mag-switch-01',
       'In the cited magnetic-switch test, which reading meets the pass threshold?'),
      ('no-crank-mag-switch-02',
       'In the cited magnetic-switch test, which reading is a failure?'),
      ('no-crank-park-neutral-01',
       'Which selector positions does Ford specify for starting an automatic-transmission vehicle?'),
      ('no-crank-pinion-inspection-01',
       'After removing a starter during mechanical diagnosis, which parts should be checked for damage?'),
      ('no-crank-pinion-inspection-02',
       'Which finding supports a mechanical starter-engagement fault?'),
      ('no-crank-relay-command-01',
       'Which ECM command should be active when the control system requests starter operation?'),
      ('no-crank-s-terminal-01',
       'When should the starter S-terminal be checked for 12 volts?'),
      ('no-crank-s-terminal-02',
       'What voltage does the cited procedure expect at the starter S-terminal during a start command?'),
      ('no-crank-terminal-cleaning-01',
       'Before cleaning battery terminal pads, what does the cited procedure direct the technician to do?'),
      ('no-crank-terminal-cleaning-02',
       'What tool does the cited battery procedure specify for cleaning terminal pads?'),
      ('no-crank-voltage-drop-01',
       'A positive-side starter voltage-drop test measures loss across which path?'),
      ('no-crank-voltage-drop-02',
       'Which test evaluates voltage lost through a starter cable and its connections?')
),
updated as (
    update public.scenario_questions sq
       set question_id = sm.question_id
      from semantic_map sm
     where sq.scenario_id = 'no-crank'
       and sq.question_text = sm.question_text
       and (
           sq.question_id is null
           or sq.question_id = sm.question_id
       )
    returning sq.question_id
)
select count(*) from updated;

do $$
declare
    mapped_count integer;
    approved_match_count integer;
begin
    select count(*)
      into mapped_count
      from public.scenario_questions
     where scenario_id = 'no-crank'
       and question_id like 'no-crank-%';

    if mapped_count <> 20 then
        raise exception
            'Expected 20 mapped no-crank questions; found %',
            mapped_count;
    end if;

    select count(distinct sq.id)
      into approved_match_count
      from public.scenario_questions sq
      join public.question_provenance qp
        on qp.question_id = sq.question_id
       and qp.status = 'approved'
     where sq.scenario_id = 'no-crank';

    if approved_match_count <> 20 then
        raise exception
            'Expected 20 approved provenance matches; found %',
            approved_match_count;
    end if;
end
$$;

comment on column public.scenario_questions.question_id is
    'Stable semantic question identifier used to join assessment content to provenance records.';

commit;
