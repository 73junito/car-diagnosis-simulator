begin;

insert into public.curriculum_courses (
  id, program_id, academic_level, cip_code, title, status
)
values (
  'hybrid-electric-vehicle-technology',
  'automotive-technology',
  'undergraduate',
  '47.0604',
  'Hybrid & Electric Vehicle Technology',
  'planned'
)
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
values (
  'ug-hev-safe-diagnostic-reasoning',
  'hybrid-electric-vehicle-technology',
  'undergraduate',
  null,
  'Explain electrified-vehicle energy flow, distinguish voltage domains and system roles, and use documented evidence to select safe, vehicle-specific diagnostic next steps without treating one symptom, code, or measurement as proof of component failure.',
  'planned'
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
values (
  'ug-hev-foundations',
  'hybrid-electric-vehicle-technology',
  'ug-hev-safe-diagnostic-reasoning',
  'undergraduate',
  'Electrified-Vehicle Architecture, Safety Boundaries, and Diagnostic Evidence',
  'planned'
)
on conflict (id) do update set
  course_id = excluded.course_id,
  competency_id = excluded.competency_id,
  academic_level = excluded.academic_level,
  title = excluded.title,
  status = excluded.status,
  updated_at = now();

insert into public.curriculum_lesson_steps (lesson_plan_id, position, step_text)
values
  ('ug-hev-foundations',1,'Define system boundaries'),
  ('ug-hev-foundations',2,'Trace energy flow'),
  ('ug-hev-foundations',3,'Distinguish voltage domains'),
  ('ug-hev-foundations',4,'Recognize safety controls'),
  ('ug-hev-foundations',5,'Interpret diagnostic evidence'),
  ('ug-hev-foundations',6,'Select a vehicle-specific next check'),
  ('ug-hev-foundations',7,'Practice with a documented scenario'),
  ('ug-hev-foundations',8,'Verify and document reasoning')
on conflict (lesson_plan_id, position) do update set
  step_text = excluded.step_text;

commit;
