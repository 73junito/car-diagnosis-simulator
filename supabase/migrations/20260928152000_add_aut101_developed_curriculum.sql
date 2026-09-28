begin;

insert into public.curriculum_courses (
  id, program_id, academic_level, cip_code, title, status
)
values (
  'aut-101',
  'automotive-technology',
  'undergraduate',
  '47.0604',
  'Introduction to Automotive Technology',
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
  'ug-aut101-systems-professional-foundations',
  'aut-101',
  'undergraduate',
  null,
  'Explain major vehicle-system roles, distinguish observations from diagnostic conclusions, and use safety, professional practice, and technical information to plan an evidence-based next step.',
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
  'ug-aut101-foundations',
  'aut-101',
  'ug-aut101-systems-professional-foundations',
  'undergraduate',
  'Automotive Systems, Professional Practice, and Evidence Foundations',
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
  ('ug-aut101-foundations',1,'Orient to vehicle systems'),
  ('ug-aut101-foundations',2,'Connect system roles'),
  ('ug-aut101-foundations',3,'Recognize safety and professional boundaries'),
  ('ug-aut101-foundations',4,'Distinguish concern, observation, test, and conclusion'),
  ('ug-aut101-foundations',5,'Use technical information'),
  ('ug-aut101-foundations',6,'Follow a basic diagnostic workflow'),
  ('ug-aut101-foundations',7,'Practice with a guided vehicle concern'),
  ('ug-aut101-foundations',8,'Explain and document the next step')
on conflict (lesson_plan_id, position) do update set
  step_text = excluded.step_text;

commit;
