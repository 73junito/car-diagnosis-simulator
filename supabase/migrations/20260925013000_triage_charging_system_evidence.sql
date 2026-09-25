begin;

-- Reconcile the approved source note with the authoritative rights/status fields.
update public.approved_sources
set notes = 'Publisher license verified; reuse permission and CC BY attribution requirements were human-reviewed. PDF was independently downloaded twice with matching SHA-256. Source is approved for evidence use.'
where id = 'frontiers-automotive-alternator-2023'
  and status = 'approved';

-- Existing charging-system questions directly supported by the approved Frontiers chunks.
with supported(question_id, chunk_id, evidence_note) as (
  values
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2'::text,
     'frontiers-alternator-ac-dc-rectification-p7'::text,
     'Supported by approved evidence describing alternator rotor, stator, diode rectifier, and voltage regulator components.'::text),
    ('5b432ab1-efd1-4ef6-8937-30749e78f892',
     'frontiers-alternator-primary-source-p7',
     'Supported by approved evidence describing the alternator as the primary source of electric energy in a vehicle.'),
    ('47c057ce-2e41-4ba6-b96e-6c3311417724',
     'frontiers-alternator-ac-dc-rectification-p7',
     'Supported by approved evidence describing DC diode rectification. Duplicate-content review is still required.'),
    ('f52216b1-cb9c-4162-9a23-f2100aa30381',
     'frontiers-alternator-ac-dc-rectification-p7',
     'Supported by approved evidence describing DC diode rectification. Duplicate-content review is still required.'),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68',
     'frontiers-alternator-primary-source-p7',
     'Supported by approved evidence describing the alternator as the primary source of electric energy in a vehicle.')
)
update public.question_provenance qp
set status = 'source-linked',
    notes = concat_ws(E'\n', nullif(qp.notes, ''), '[evidence-linked] ' || s.evidence_note ||
      ' Citation validation plus technical and instructional review remain required.')
from supported s
where qp.question_id = s.question_id
  and qp.provenance_version = 1
  and qp.status = 'draft';

-- Add answer/explanation citations for directly supported questions.
with supported(question_id, chunk_id) as (
  values
    ('ba2541c8-f70b-4730-a7c3-c2c5113511e2'::text, 'frontiers-alternator-ac-dc-rectification-p7'::text),
    ('5b432ab1-efd1-4ef6-8937-30749e78f892', 'frontiers-alternator-primary-source-p7'),
    ('47c057ce-2e41-4ba6-b96e-6c3311417724', 'frontiers-alternator-ac-dc-rectification-p7'),
    ('f52216b1-cb9c-4162-9a23-f2100aa30381', 'frontiers-alternator-ac-dc-rectification-p7'),
    ('49dad565-9f85-476a-b87b-cbc31ce5bb68', 'frontiers-alternator-primary-source-p7')
),
roles(role) as (
  values ('supports-answer'::text), ('supports-explanation'::text)
)
insert into public.question_citations (
  id, question_provenance_id, source_id, chunk_id, locator, role
)
select
  gen_random_uuid(),
  qp.id,
  'frontiers-automotive-alternator-2023',
  s.chunk_id,
  'PDF page 7',
  r.role
from supported s
join public.question_provenance qp
  on qp.question_id = s.question_id
 and qp.provenance_version = 1
cross join roles r
where not exists (
  select 1
  from public.question_citations qc
  where qc.question_provenance_id = qp.id
    and qc.source_id = 'frontiers-automotive-alternator-2023'
    and qc.chunk_id = s.chunk_id
    and qc.role = r.role
);

-- Questions whose present claims are not supported by the currently approved evidence.
with evidence_needed(question_id, gap_note) as (
  values
    ('f6ba3fc5-25bd-4504-b758-47f4a25eb792'::text,
     'Needs approved evidence for sudden charging-system failure causes.'::text),
    ('0172e15b-6cc4-4a2f-bca2-17ffb768c9e8',
     'Needs approved evidence linking dim dashboard lights with charging-system conditions.'),
    ('021c7ff9-0a84-41ab-ac17-a43ed7ab48e7',
     'Needs approved evidence for battery-terminal inspection and cleaning within charging-system diagnosis.'),
    ('835b46ac-92fc-41d3-91ea-b9c2dd053573',
     'Needs approved evidence that connects voltage regulation with battery-charge control and overcharge prevention.'),
    ('ded7d121-0fba-4081-91e3-4742dd1b00fa',
     'Needs approved evidence for charging-system failure symptoms.'),
    ('7bc5e4c2-93d4-4366-b56f-b8e0a09186ef',
     'Needs approved evidence for voltage-drop testing procedure and tool selection.')
)
update public.question_provenance qp
set notes = concat_ws(E'\n', nullif(qp.notes, ''), '[evidence-needed] ' || e.gap_note ||
  ' Keep in draft; do not promote until evidence is approved and linked.')
from evidence_needed e
where qp.question_id = e.question_id
  and qp.provenance_version = 1
  and qp.status = 'draft'
  and qp.notes not like '%[evidence-needed]%';

commit;
