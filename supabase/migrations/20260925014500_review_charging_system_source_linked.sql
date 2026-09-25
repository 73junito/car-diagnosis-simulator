begin;

-- AI-assisted evidence/content review of currently source-linked charging-system questions.
-- This migration does NOT complete technical review, instructional review, citation validation,
-- or approval. It only records evidence-fit findings and retires clear duplicates/overclaims.

with keepers(question_id, review_note) as (
  values
    ('charging-system-ai-draft-e67fed5cd983'::text,
     'AI-assisted content review: evidence directly supports the alternator being a synchronous AC generator. Keep source-linked; human technical/instructional review still required.'::text),
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2',
     'AI-assisted content review: evidence directly supports rotor, stator, diode rectifier, and voltage regulator as alternator components. Keep source-linked; human technical/instructional review still required.'),
    ('charging-system-ai-draft-4cfd549ec9be',
     'AI-assisted content review: evidence directly supports approximately 55% alternator efficiency. Keep source-linked; human technical/instructional review still required.'),
    ('47c057ce-2e41-4ba6-b96e-6c3311417724',
     'AI-assisted content review: evidence directly supports DC diode rectification. Keep this item as the canonical AC-to-DC question; human technical/instructional review still required.'),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68',
     'AI-assisted content review: evidence directly supports the alternator as the primary source of electric energy in a vehicle. Keep this item as the canonical primary-source question; human technical/instructional review still required.'),
    ('charging-system-ai-draft-0f3a2f20daca',
     'AI-assisted content review: evidence directly supports pulse-width modulation voltage control. Keep source-linked; human technical/instructional review still required.')
)
update public.question_provenance qp
set notes = concat_ws(E'\n', nullif(qp.notes, ''), k.review_note)
from keepers k
where qp.question_id = k.question_id
  and qp.provenance_version = 1
  and qp.status = 'source-linked'
  and qp.notes not like '%AI-assisted content review:%';

with retirements(question_id, review_note) as (
  values
    ('f52216b1-cb9c-4162-9a23-f2100aa30381'::text,
     'Retired during AI-assisted content review as a near-duplicate of question 47c057ce-2e41-4ba6-b96e-6c3311417724; both assess AC-to-DC rectification from the same evidence.'::text),
    ('5b432ab1-efd1-4ef6-8937-30749e78f892',
     'Retired during AI-assisted content review because the answer/explanation add battery-charging claims not stated in the currently approved evidence and substantially overlap question 49dad565-9f85-476a-b87b-cbc31ce5bb68.')
)
update public.question_provenance qp
set status = 'retired',
    notes = concat_ws(E'\n', nullif(qp.notes, ''), r.review_note)
from retirements r
where qp.question_id = r.question_id
  and qp.provenance_version = 1
  and qp.status = 'source-linked';

commit;
