begin;

-- Canonical curriculum schema. Extends the existing competency/scenario foundation
-- without duplicating public.competency_areas or public.scenario_catalog.

create table if not exists public.curriculum_pathways (
  id text primary key,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  status text not null check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_pathways_id_not_blank check (btrim(id) <> ''),
  constraint curriculum_pathways_id_level_unique unique (id, academic_level)
);

create table if not exists public.curriculum_programs (
  id text primary key,
  pathway_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  cip_code text not null check (cip_code ~ '^[0-9]{2}\.[0-9]{4}$'),
  program_name text not null,
  cip_title text not null,
  classification_system text not null default 'CIP',
  authority_name text,
  authority_reference text,
  verification_status text not null check (verification_status in ('verified','project-planned')),
  status text not null check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_programs_pathway_level_fkey
    foreign key (pathway_id, academic_level)
    references public.curriculum_pathways(id, academic_level)
    on delete restrict,
  constraint curriculum_programs_id_level_cip_unique unique (id, academic_level, cip_code)
);

create table if not exists public.curriculum_courses (
  id text primary key,
  program_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  cip_code text not null check (cip_code ~ '^[0-9]{2}\.[0-9]{4}$'),
  title text not null,
  status text not null check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_courses_program_level_cip_fkey
    foreign key (program_id, academic_level, cip_code)
    references public.curriculum_programs(id, academic_level, cip_code)
    on delete restrict,
  constraint curriculum_courses_id_level_unique unique (id, academic_level),
  constraint curriculum_courses_id_level_cip_unique unique (id, academic_level, cip_code)
);

create table if not exists public.curriculum_competencies (
  id text primary key,
  course_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  competency_area_id uuid references public.competency_areas(id) on delete restrict,
  statement text not null,
  status text not null check (status in ('draft','planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_competencies_course_level_fkey
    foreign key (course_id, academic_level)
    references public.curriculum_courses(id, academic_level)
    on delete restrict,
  constraint curriculum_competencies_id_course_level_unique
    unique (id, course_id, academic_level)
);

create table if not exists public.curriculum_lesson_plans (
  id text primary key,
  course_id text not null,
  competency_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  title text not null,
  status text not null check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_lesson_plans_course_level_fkey
    foreign key (course_id, academic_level)
    references public.curriculum_courses(id, academic_level)
    on delete restrict,
  constraint curriculum_lesson_plans_competency_course_level_fkey
    foreign key (competency_id, course_id, academic_level)
    references public.curriculum_competencies(id, course_id, academic_level)
    on delete restrict,
  constraint curriculum_lesson_plans_mapping_unique
    unique (id, course_id, competency_id, academic_level)
);

create table if not exists public.curriculum_lesson_steps (
  lesson_plan_id text not null references public.curriculum_lesson_plans(id) on delete cascade,
  position integer not null check (position > 0),
  step_text text not null check (btrim(step_text) <> ''),
  created_at timestamptz not null default now(),
  primary key (lesson_plan_id, position)
);

create table if not exists public.curriculum_lesson_evidence (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id text not null
    references public.curriculum_lesson_plans(id) on delete cascade,
  chunk_id text not null
    references public.source_chunks(chunk_id) on delete restrict,
  evidence_role text not null
    check (evidence_role in ('supports-lesson','supports-competency','research-reference')),
  status text not null default 'planned'
    check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  constraint curriculum_lesson_evidence_unique
    unique (lesson_plan_id, chunk_id, evidence_role)
);

create table if not exists public.scenario_curriculum_mappings (
  scenario_id text not null references public.scenario_catalog(scenario_id) on delete restrict,
  lesson_plan_id text not null,
  competency_id text not null,
  course_id text not null,
  academic_level text not null check (academic_level in ('undergraduate','graduate')),
  cip_code text not null check (cip_code ~ '^[0-9]{2}\.[0-9]{4}$'),
  status text not null check (status in ('planned','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scenario_id, lesson_plan_id),
  constraint scenario_curriculum_course_level_cip_fkey
    foreign key (course_id, academic_level, cip_code)
    references public.curriculum_courses(id, academic_level, cip_code)
    on delete restrict,
  constraint scenario_curriculum_competency_course_level_fkey
    foreign key (competency_id, course_id, academic_level)
    references public.curriculum_competencies(id, course_id, academic_level)
    on delete restrict,
  constraint scenario_curriculum_lesson_mapping_fkey
    foreign key (lesson_plan_id, course_id, competency_id, academic_level)
    references public.curriculum_lesson_plans(id, course_id, competency_id, academic_level)
    on delete restrict
);

create index if not exists idx_curriculum_programs_level_cip
  on public.curriculum_programs(academic_level, cip_code);
create index if not exists idx_curriculum_programs_pathway_level
  on public.curriculum_programs(pathway_id, academic_level);
create index if not exists idx_curriculum_courses_program
  on public.curriculum_courses(program_id);
create index if not exists idx_curriculum_courses_program_level_cip
  on public.curriculum_courses(program_id, academic_level, cip_code);
create index if not exists idx_curriculum_competencies_course
  on public.curriculum_competencies(course_id);
create index if not exists idx_curriculum_competencies_course_level
  on public.curriculum_competencies(course_id, academic_level);
create index if not exists idx_curriculum_competencies_area
  on public.curriculum_competencies(competency_area_id)
  where competency_area_id is not null;
create index if not exists idx_curriculum_lessons_course
  on public.curriculum_lesson_plans(course_id);
create index if not exists idx_curriculum_lessons_course_level
  on public.curriculum_lesson_plans(course_id, academic_level);
create index if not exists idx_curriculum_lessons_competency_course_level
  on public.curriculum_lesson_plans(competency_id, course_id, academic_level);
create index if not exists idx_curriculum_lesson_evidence_chunk
  on public.curriculum_lesson_evidence(chunk_id);
create index if not exists idx_scenario_curriculum_course
  on public.scenario_curriculum_mappings(course_id);
create index if not exists idx_scenario_curriculum_course_level_cip
  on public.scenario_curriculum_mappings(course_id, academic_level, cip_code);
create index if not exists idx_scenario_curriculum_competency_course_level
  on public.scenario_curriculum_mappings(competency_id, course_id, academic_level);
create index if not exists idx_scenario_curriculum_lesson_mapping
  on public.scenario_curriculum_mappings(lesson_plan_id, course_id, competency_id, academic_level);

comment on table public.curriculum_pathways is
  'Top-level academic organization. Academic level is explicit and is not inferred from CIP.';
comment on table public.curriculum_programs is
  'Program and CIP classification records. Verification state separates authority-backed records from project-planned classifications.';
comment on table public.curriculum_courses is
  'Curriculum courses linked to a program while retaining explicit academic_level and cip_code fields.';
comment on table public.curriculum_competencies is
  'Course-level instructional competencies. Optional competency_area_id links to the existing TorqueMind semantic competency taxonomy.';
comment on table public.curriculum_lesson_plans is
  'Competency-linked lesson plans.';
comment on table public.curriculum_lesson_steps is
  'Ordered lesson-plan sequence.';
comment on table public.curriculum_lesson_evidence is
  'Optional lesson-to-evidence links. References existing approved source chunks; does not duplicate source metadata or bypass evidence approval.';
comment on table public.scenario_curriculum_mappings is
  'Scenario-to-curriculum mapping using the existing scenario_catalog as the scenario authority.';

alter table public.curriculum_pathways enable row level security;
alter table public.curriculum_programs enable row level security;
alter table public.curriculum_courses enable row level security;
alter table public.curriculum_competencies enable row level security;
alter table public.curriculum_lesson_plans enable row level security;
alter table public.curriculum_lesson_steps enable row level security;
alter table public.curriculum_lesson_evidence enable row level security;
alter table public.scenario_curriculum_mappings enable row level security;

-- Schema phase is service-role only. Browser access will be introduced
-- explicitly in a later API/UI phase after staging validation.
revoke all on table public.curriculum_pathways from public, anon, authenticated;
revoke all on table public.curriculum_programs from public, anon, authenticated;
revoke all on table public.curriculum_courses from public, anon, authenticated;
revoke all on table public.curriculum_competencies from public, anon, authenticated;
revoke all on table public.curriculum_lesson_plans from public, anon, authenticated;
revoke all on table public.curriculum_lesson_steps from public, anon, authenticated;
revoke all on table public.curriculum_lesson_evidence from public, anon, authenticated;
revoke all on table public.scenario_curriculum_mappings from public, anon, authenticated;

grant select, insert, update, delete on table public.curriculum_pathways to service_role;
grant select, insert, update, delete on table public.curriculum_programs to service_role;
grant select, insert, update, delete on table public.curriculum_courses to service_role;
grant select, insert, update, delete on table public.curriculum_competencies to service_role;
grant select, insert, update, delete on table public.curriculum_lesson_plans to service_role;
grant select, insert, update, delete on table public.curriculum_lesson_steps to service_role;
grant select, insert, update, delete on table public.curriculum_lesson_evidence to service_role;
grant select, insert, update, delete on table public.scenario_curriculum_mappings to service_role;

insert into public.curriculum_pathways (id, academic_level, status)
values
  ('undergraduate','undergraduate','active'),
  ('graduate','graduate','planned')
on conflict (id) do update set
  academic_level = excluded.academic_level,
  status = excluded.status,
  updated_at = now();

insert into public.curriculum_programs (
  id, pathway_id, academic_level, cip_code, program_name, cip_title,
  classification_system, authority_name, authority_reference,
  verification_status, status
)
values
  (
    'automotive-technology','undergraduate','undergraduate','47.0604',
    'Automotive Technology',
    'Automobile/Automotive Mechanics Technology/Technician',
    'CIP','Kansas Board of Regents',
    'https://kansasregents.gov/workforce_development/program-alignment/automotive_technology',
    'verified','active'
  ),
  (
    'automotive-engineering-technology','graduate','graduate','15.0803',
    'Automotive Engineering Technology',
    'Automotive Engineering Technology/Technician',
    'CIP',null,null,'project-planned','planned'
  )
on conflict (id) do update set
  pathway_id = excluded.pathway_id,
  academic_level = excluded.academic_level,
  cip_code = excluded.cip_code,
  program_name = excluded.program_name,
  cip_title = excluded.cip_title,
  classification_system = excluded.classification_system,
  authority_name = excluded.authority_name,
  authority_reference = excluded.authority_reference,
  verification_status = excluded.verification_status,
  status = excluded.status,
  updated_at = now();

insert into public.curriculum_courses (id, program_id, academic_level, cip_code, title, status)
values
  ('electrical-1','automotive-technology','undergraduate','47.0604','Electrical 1','active'),
  ('brakes-1','automotive-technology','undergraduate','47.0604','Brakes 1','planned'),
  ('engine-performance-1','automotive-technology','undergraduate','47.0604','Engine Performance 1','planned'),
  ('suspension-steering-1','automotive-technology','undergraduate','47.0604','Suspension & Steering 1','planned'),
  ('advanced-diagnostic-analysis','automotive-engineering-technology','graduate','15.0803','Advanced Diagnostic Analysis','planned'),
  ('vehicle-systems-testing','automotive-engineering-technology','graduate','15.0803','Vehicle Systems and Testing','planned'),
  ('curriculum-assessment-design','automotive-engineering-technology','graduate','15.0803','Curriculum & Assessment Design','planned'),
  ('applied-research','automotive-engineering-technology','graduate','15.0803','Applied Research','planned'),
  ('technical-instructional-leadership','automotive-engineering-technology','graduate','15.0803','Technical Instructional Leadership','planned')
on conflict (id) do update set
  program_id = excluded.program_id,
  academic_level = excluded.academic_level,
  cip_code = excluded.cip_code,
  title = excluded.title,
  status = excluded.status,
  updated_at = now();

insert into public.curriculum_competencies (
  id, course_id, academic_level, competency_area_id, statement, status
)
values
  (
    'ug-electrical-evidence-diagnosis','electrical-1','undergraduate',
    (select id from public.competency_areas where competency_code = 'ELEC'),
    'Use observed electrical symptoms and appropriate measurements to plan a vehicle-specific diagnostic check.','draft'
  ),
  (
    'ug-brakes-evidence-diagnosis','brakes-1','undergraduate',
    (select id from public.competency_areas where competency_code = 'BRAKES'),
    'Use inspection findings and measurements to diagnose brake-system concerns and verify corrective action.','planned'
  ),
  (
    'ug-engine-performance-analysis','engine-performance-1','undergraduate',
    (select id from public.competency_areas where competency_code = 'PERF'),
    'Interpret operating data and test results to diagnose engine-performance concerns and verify repairs.','planned'
  ),
  (
    'ug-suspension-steering-analysis','suspension-steering-1','undergraduate',
    (select id from public.competency_areas where competency_code = 'SUSP_STEER'),
    'Use inspection, geometry, and component evidence to diagnose suspension and steering concerns.','planned'
  ),
  (
    'grad-advanced-diagnostic-analysis','advanced-diagnostic-analysis','graduate',
    (select id from public.competency_areas where competency_code = 'ADV_DIAG'),
    'Evaluate complex vehicle-system evidence, uncertainty, competing hypotheses, and verification strategies.','planned'
  ),
  (
    'grad-vehicle-systems-testing','vehicle-systems-testing','graduate',
    (select id from public.competency_areas where competency_code = 'ADV_DIAG'),
    'Design and evaluate advanced vehicle-system tests using appropriate instrumentation, controls, and technical evidence.','planned'
  ),
  (
    'grad-curriculum-assessment-design','curriculum-assessment-design','graduate',
    null,
    'Design aligned technical curriculum, authentic assessments, rubrics, and feedback systems using measurable outcomes.','planned'
  ),
  (
    'grad-applied-research','applied-research','graduate',
    null,
    'Design and evaluate applied technical-education or diagnostic investigations using transparent scholarly evidence.','planned'
  ),
  (
    'grad-technical-instructional-leadership','technical-instructional-leadership','graduate',
    null,
    'Use evidence-informed leadership practices to improve technical programs, instruction, learner support, and faculty practice.','planned'
  )
on conflict (id) do update set
  course_id = excluded.course_id,
  academic_level = excluded.academic_level,
  competency_area_id = excluded.competency_area_id,
  statement = excluded.statement,
  status = excluded.status,
  updated_at = now();

insert into public.curriculum_lesson_plans (
  id, course_id, competency_id, academic_level, title, status
)
values
  ('ug-electrical-charging-system','electrical-1','ug-electrical-evidence-diagnosis','undergraduate','Charging-System Evidence and Diagnostic Decisions','active'),
  ('ug-brakes-foundations','brakes-1','ug-brakes-evidence-diagnosis','undergraduate','Brake-System Evidence and Verification','planned'),
  ('ug-engine-performance-foundations','engine-performance-1','ug-engine-performance-analysis','undergraduate','Engine-Performance Data Interpretation','planned'),
  ('ug-suspension-steering-foundations','suspension-steering-1','ug-suspension-steering-analysis','undergraduate','Suspension and Steering Evidence Analysis','planned'),
  ('grad-diagnostic-evidence-analysis','advanced-diagnostic-analysis','grad-advanced-diagnostic-analysis','graduate','Advanced Diagnostic Evidence Analysis','planned'),
  ('grad-vehicle-systems-testing','vehicle-systems-testing','grad-vehicle-systems-testing','graduate','Advanced Vehicle Systems Testing','planned'),
  ('grad-curriculum-assessment-design','curriculum-assessment-design','grad-curriculum-assessment-design','graduate','Technical Curriculum and Assessment Design','planned'),
  ('grad-applied-research-literature','applied-research','grad-applied-research','graduate','Scholarly Evidence for Applied Automotive Research','planned'),
  ('grad-technical-instructional-leadership','technical-instructional-leadership','grad-technical-instructional-leadership','graduate','Evidence-Informed Technical Instructional Leadership','planned')
on conflict (id) do update set
  course_id = excluded.course_id,
  competency_id = excluded.competency_id,
  academic_level = excluded.academic_level,
  title = excluded.title,
  status = excluded.status,
  updated_at = now();

delete from public.curriculum_lesson_steps
where lesson_plan_id in (
  'ug-electrical-charging-system',
  'ug-brakes-foundations',
  'ug-engine-performance-foundations',
  'ug-suspension-steering-foundations',
  'grad-diagnostic-evidence-analysis',
  'grad-vehicle-systems-testing',
  'grad-curriculum-assessment-design',
  'grad-applied-research-literature',
  'grad-technical-instructional-leadership'
);

insert into public.curriculum_lesson_steps (lesson_plan_id, position, step_text)
values
  ('ug-electrical-charging-system',1,'Present concern'),
  ('ug-electrical-charging-system',2,'Explain system'),
  ('ug-electrical-charging-system',3,'Demonstrate check'),
  ('ug-electrical-charging-system',4,'Guided practice'),
  ('ug-electrical-charging-system',5,'Independent scenario'),
  ('ug-electrical-charging-system',6,'Explain decision'),
  ('ug-electrical-charging-system',7,'Feedback and retry'),
  ('ug-electrical-charging-system',8,'Document verification'),
  ('ug-brakes-foundations',1,'Present concern'),
  ('ug-brakes-foundations',2,'Inspect system'),
  ('ug-brakes-foundations',3,'Measure condition'),
  ('ug-brakes-foundations',4,'Compare specifications'),
  ('ug-brakes-foundations',5,'Diagnose cause'),
  ('ug-brakes-foundations',6,'Verify corrective action'),
  ('ug-engine-performance-foundations',1,'Define concern'),
  ('ug-engine-performance-foundations',2,'Review operating data'),
  ('ug-engine-performance-foundations',3,'Form hypotheses'),
  ('ug-engine-performance-foundations',4,'Select tests'),
  ('ug-engine-performance-foundations',5,'Interpret results'),
  ('ug-engine-performance-foundations',6,'Verify repair'),
  ('ug-suspension-steering-foundations',1,'Define concern'),
  ('ug-suspension-steering-foundations',2,'Inspect components'),
  ('ug-suspension-steering-foundations',3,'Measure geometry'),
  ('ug-suspension-steering-foundations',4,'Compare evidence'),
  ('ug-suspension-steering-foundations',5,'Diagnose cause'),
  ('ug-suspension-steering-foundations',6,'Verify correction'),
  ('grad-diagnostic-evidence-analysis',1,'Frame the diagnostic problem'),
  ('grad-diagnostic-evidence-analysis',2,'Review scholarly and technical evidence'),
  ('grad-diagnostic-evidence-analysis',3,'Compare competing hypotheses'),
  ('grad-diagnostic-evidence-analysis',4,'Evaluate measurement uncertainty'),
  ('grad-diagnostic-evidence-analysis',5,'Design a verification strategy'),
  ('grad-diagnostic-evidence-analysis',6,'Defend the diagnostic conclusion'),
  ('grad-vehicle-systems-testing',1,'Define test objective'),
  ('grad-vehicle-systems-testing',2,'Select instrumentation'),
  ('grad-vehicle-systems-testing',3,'Establish controls'),
  ('grad-vehicle-systems-testing',4,'Collect measurements'),
  ('grad-vehicle-systems-testing',5,'Analyze uncertainty'),
  ('grad-vehicle-systems-testing',6,'Report findings'),
  ('grad-curriculum-assessment-design',1,'Define outcomes'),
  ('grad-curriculum-assessment-design',2,'Map competencies'),
  ('grad-curriculum-assessment-design',3,'Design authentic tasks'),
  ('grad-curriculum-assessment-design',4,'Develop rubrics'),
  ('grad-curriculum-assessment-design',5,'Plan feedback'),
  ('grad-curriculum-assessment-design',6,'Evaluate alignment'),
  ('grad-applied-research-literature',1,'Define the research question'),
  ('grad-applied-research-literature',2,'Search Google Scholar'),
  ('grad-applied-research-literature',3,'Resolve canonical DOI or publisher source'),
  ('grad-applied-research-literature',4,'Evaluate relevance and methods'),
  ('grad-applied-research-literature',5,'Map evidence to claims'),
  ('grad-applied-research-literature',6,'Document provenance'),
  ('grad-technical-instructional-leadership',1,'Diagnose program needs'),
  ('grad-technical-instructional-leadership',2,'Review evidence'),
  ('grad-technical-instructional-leadership',3,'Engage stakeholders'),
  ('grad-technical-instructional-leadership',4,'Design improvement'),
  ('grad-technical-instructional-leadership',5,'Implement change'),
  ('grad-technical-instructional-leadership',6,'Evaluate outcomes');

-- Complete the existing scenario catalog for the curriculum mappings.
insert into public.scenario_catalog (
  scenario_id, title, description, active, competency_area_id
)
values (
  'electrical-load',
  'Electrical Load',
  'Charging-system output and alternator load testing.',
  true,
  (select id from public.competency_areas where competency_code = 'ELEC')
)
on conflict (scenario_id) do update set
  title = excluded.title,
  description = excluded.description,
  active = excluded.active,
  competency_area_id = coalesce(public.scenario_catalog.competency_area_id, excluded.competency_area_id);

update public.scenario_catalog
set competency_area_id = (select id from public.competency_areas where competency_code = 'ELEC')
where scenario_id = 'charging-system'
  and competency_area_id is null;

-- Connect the existing semantic taxonomy to the verified undergraduate program.
insert into public.competency_to_program_map (
  competency_area_id, jurisdiction_code, authority_name,
  classification_system, classification_code, classification_name,
  program_name, notes
)
select
  ca.id,
  'KS',
  'Kansas Board of Regents',
  'CIP',
  '47.0604',
  'Automobile/Automotive Mechanics Technology/Technician',
  'Automotive Technology',
  'Seeded from the canonical AutoLearnPro undergraduate curriculum contract.'
from public.competency_areas ca
where ca.competency_code in ('ELEC','BRAKES','PERF','SUSP_STEER')
on conflict (
  competency_area_id,
  jurisdiction_code,
  authority_name,
  classification_system,
  classification_code
) do update set
  classification_name = excluded.classification_name,
  program_name = excluded.program_name,
  notes = excluded.notes;

insert into public.scenario_curriculum_mappings (
  scenario_id, lesson_plan_id, competency_id, course_id,
  academic_level, cip_code, status
)
values
  (
    'charging-system','ug-electrical-charging-system',
    'ug-electrical-evidence-diagnosis','electrical-1',
    'undergraduate','47.0604','active'
  ),
  (
    'electrical-load','ug-electrical-charging-system',
    'ug-electrical-evidence-diagnosis','electrical-1',
    'undergraduate','47.0604','active'
  )
on conflict (scenario_id, lesson_plan_id) do update set
  competency_id = excluded.competency_id,
  course_id = excluded.course_id,
  academic_level = excluded.academic_level,
  cip_code = excluded.cip_code,
  status = excluded.status,
  updated_at = now();

commit;
