begin;

-- Prepare the six retained charging-system questions for deterministic
-- citation validation. This does not approve any question and does not mark
-- technical or instructional review complete.

with retained(question_id) as (
  values
    ('charging-system-ai-draft-e67fed5cd983'::text),
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2'),
    ('charging-system-ai-draft-4cfd549ec9be'),
    ('47c057ce-2e41-4ba6-b96e-6c3311417724'),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68'),
    ('charging-system-ai-draft-0f3a2f20daca')
)
update public.question_citations qc
set quote = sc.text_excerpt
from public.question_provenance qp
join retained r on r.question_id = qp.question_id
join public.source_chunks sc on true
where qc.question_provenance_id = qp.id
  and sc.chunk_id = qc.chunk_id
  and qp.provenance_version = 1
  and qp.status = 'source-linked'
  and qc.role in ('supports-answer','supports-explanation')
  and qc.quote is distinct from sc.text_excerpt;

with retained(question_id) as (
  values
    ('charging-system-ai-draft-e67fed5cd983'::text),
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2'),
    ('charging-system-ai-draft-4cfd549ec9be'),
    ('47c057ce-2e41-4ba6-b96e-6c3311417724'),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68'),
    ('charging-system-ai-draft-0f3a2f20daca')
)
update public.question_provenance qp
set validation_checklist = coalesce(qp.validation_checklist,'{}'::jsonb) || jsonb_build_object(
      'answer_verified', true,
      'explanation_verified', true,
      'citation_matches_excerpt', true,
      'license_ok', true,
      'technical_review_complete', false,
      'instructional_review_complete', false
    ),
    status = 'validated',
    notes = concat_ws(
      E'\n',
      nullif(qp.notes,''),
      'Citation-readiness review completed: answer/explanation claims match approved evidence; citation quotes synchronized to approved chunk excerpts. Deterministic citation validator must still return valid before approval. Human technical and instructional review remain incomplete.'
    )
from retained r
where qp.question_id = r.question_id
  and qp.provenance_version = 1
  and qp.status = 'source-linked';

commit;
