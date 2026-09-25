begin;

-- Revise the two technical-review distractors that were flagged as ambiguous.
-- Replacement distractors are concepts explicitly present in the same approved
-- evidence chunk and are non-overlapping with the keyed answer.
update public.scenario_questions
set option_c = 'DC diode rectification'
where question_id = 'charging-system-ai-draft-0f3a2f20daca'
  and option_c = 'Feedback control';

update public.scenario_questions
set option_d = 'Voltage regulator'
where question_id = 'charging-system-ai-draft-e67fed5cd983'
  and option_d = 'Permanent magnet generator';

-- A content revision requires a fresh technical decision. Preserve validated
-- citation state, but clear technical-review completion and reviewer attribution.
update public.question_provenance
set notes = concat_ws(
      E'\n',
      nullif(notes,''),
      '[technical-revision] Replaced the flagged ambiguous distractor with a non-overlapping concept explicitly present in the approved evidence. Technical re-review remains required; no approval or instructional-review decision is made.'
    ),
    validation_checklist = coalesce(validation_checklist,'{}'::jsonb)
      || jsonb_build_object('technical_review_complete', false),
    technical_reviewer_id = null,
    technical_reviewed_at = null
where question_id in (
  'charging-system-ai-draft-0f3a2f20daca',
  'charging-system-ai-draft-e67fed5cd983'
)
  and provenance_version = 1
  and status = 'validated'
  and notes not like '%[technical-revision]%';

commit;
