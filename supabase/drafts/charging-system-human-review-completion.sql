-- HUMAN-REVIEW COMPLETION TEMPLATE — DO NOT RUN UNEDITED.
-- Purpose: record human technical and instructional review after both reviews are actually completed.
-- This is intentionally stored under supabase/drafts, not migrations.
--
-- Required before use:
--   1. Replace TECHNICAL_REVIEWER_UUID with the authenticated technical reviewer's profile UUID.
--   2. Replace INSTRUCTIONAL_REVIEWER_UUID with the authenticated instructional reviewer's profile UUID.
--   3. Confirm each of the six questions passed BOTH review checklists.
--   4. Do not promote provenance here. Approval is a separate Gate 4 action.
--
-- If any question needs revision, leave its review fields incomplete and revise/revalidate it first.

begin;

with reviewed(question_id) as (
  values
    ('47c057ce-2e41-4ba6-b96e-6c3311417724'::text),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68'),
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2'),
    ('charging-system-ai-draft-0f3a2f20daca'),
    ('charging-system-ai-draft-4cfd549ec9be'),
    ('charging-system-ai-draft-e67fed5cd983')
)
update public.question_provenance qp
set
  technical_reviewer_id = 'TECHNICAL_REVIEWER_UUID'::uuid,
  technical_reviewed_at = now(),
  instructional_reviewer_id = 'INSTRUCTIONAL_REVIEWER_UUID'::uuid,
  instructional_reviewed_at = now(),
  validation_checklist = coalesce(qp.validation_checklist, '{}'::jsonb) || jsonb_build_object(
    'technical_review_complete', true,
    'instructional_review_complete', true
  ),
  notes = concat_ws(
    E'\n',
    nullif(qp.notes, ''),
    'Human technical and instructional reviews completed; reviewer identities and timestamps recorded. Approval remains a separate action.'
  )
from reviewed r
where qp.question_id = r.question_id
  and qp.provenance_version = 1
  and qp.status = 'validated'
  and exists (
    select 1
    from public.citation_validations cv
    where cv.question_provenance_id = qp.id
      and cv.validator_version = 'citation-validator-1.0'
      and cv.result = 'valid'
      and cv.source_hashes_verified = true
      and cv.excerpts_verified = true
      and cv.urls_verified = true
  );

-- Safety assertion: this template must not approve records.
do $$
begin
  if exists (
    select 1
    from public.question_provenance qp
    where qp.question_id in (
      '47c057ce-2e41-4ba6-b96e-6c3311417724',
      '49dad565-9f85-476a-b87b-cbc31ce5bb68',
      'ba2541c8-f70b-4730-a7c3-c2c5113511e2',
      'charging-system-ai-draft-0f3a2f20daca',
      'charging-system-ai-draft-4cfd549ec9be',
      'charging-system-ai-draft-e67fed5cd983'
    )
      and qp.status = 'approved'
  ) then
    raise exception 'Unexpected approved provenance in human-review template scope';
  end if;
end
$$;

commit;
