-- Staging-only content update for the two PR #479 REVISE items.
-- Run once against torquemind-staging, then rerun citation validation and technical review.
begin;
do $revision$
declare changed integer;
begin
  update public.scenario_questions
  set question_text = 'The cited description assigns two different functions to an automotive alternator. Which option matches each process to its function?',
      option_a = 'Diode rectification converts AC to DC; pulse-width modulation controls voltage.',
      option_b = 'Pulse-width modulation converts AC to DC; diode rectification controls voltage.',
      option_c = 'Diode rectification generates AC; pulse-width modulation converts AC to DC.',
      option_d = 'Pulse-width modulation generates AC; diode rectification controls rotor speed.',
      correct_answer = 'A',
      explanation = 'The source describes DC diode rectification and pulse-width modulation voltage control as separate processes. Rectification provides DC from AC, while PWM is the voltage-control method.',
      difficulty = 'intermediate'
  where question_id = 'charging-system-ai-draft-0f3a2f20daca'
    and question_text = 'Which voltage control technique is employed by an automotive alternator?'
    and option_c = 'DC diode rectification';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'PWM question was not in expected state'; end if;

  update public.scenario_questions
  set question_text = 'According to the cited description, how is an automotive alternator classified as a generator before its output is rectified?',
      option_a = 'Commutated DC generator',
      option_b = 'Synchronous AC generator',
      option_c = 'Asynchronous induction generator',
      option_d = 'Permanent-magnet DC generator',
      correct_answer = 'B',
      explanation = 'The source classifies the alternator as a synchronous AC generator and separately describes diode rectification of its output to DC.',
      difficulty = 'intermediate'
  where question_id = 'charging-system-ai-draft-e67fed5cd983'
    and question_text = 'An automotive alternator is best described as which type of generator?'
    and option_d = 'Voltage regulator';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Generator question was not in expected state'; end if;

  update public.question_provenance
  set status = 'source-linked',
      validation_checklist = validation_checklist || '{"answer_verified":false,"explanation_verified":false,"technical_review_complete":false,"instructional_review_complete":false}'::jsonb,
      technical_reviewer_id = null,
      technical_reviewed_at = null,
      notes = concat_ws(E'\n',nullif(notes,''),'[complete-item-revision] Stem, options, answer context, and explanation revised after technical REVISE. Citation and technical re-review required; no instructional decision or approval.')
  where question_id in ('charging-system-ai-draft-0f3a2f20daca','charging-system-ai-draft-e67fed5cd983')
    and provenance_version = 1 and status = 'validated'
    and technical_reviewer_id is null and approved_at is null;
  get diagnostics changed = row_count;
  if changed <> 2 then raise exception 'Expected two validated provenance rows'; end if;

  update public.citation_validations cv
  set result = 'invalid',
      errors = jsonb_build_array('Question content changed after prior validation; rerun deterministic citation validator.')
  from public.question_provenance qp
  where cv.question_provenance_id = qp.id
    and qp.question_id in ('charging-system-ai-draft-0f3a2f20daca','charging-system-ai-draft-e67fed5cd983')
    and qp.provenance_version = 1 and cv.result = 'valid';
  get diagnostics changed = row_count;
  if changed <> 2 then raise exception 'Expected two prior valid citation results to invalidate'; end if;
end
$revision$;
commit;
