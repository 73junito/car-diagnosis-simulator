begin;

insert into public.curriculum_courses (
  id, program_id, academic_level, cip_code, title, status
)
values (
  'aut-105',
  'automotive-technology',
  'undergraduate',
  '47.0604',
  'Automotive Safety and Professional Practices',
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
  'ug-aut105-safe-professional-practice',
  'aut-105',
  'undergraduate',
  null,
  'Recognize automotive shop hazards and professional responsibilities, use applicable safety and environmental information to select a safe next action, and document when work should stop, be controlled, or be escalated.',
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
  'ug-aut105-safety-professional-practice',
  'aut-105',
  'ug-aut105-safe-professional-practice',
  'undergraduate',
  'Automotive Shop Safety, Environmental Practice, and Professional Responsibility',
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
  ('ug-aut105-safety-professional-practice',1,'Identify work-area hazards'),
  ('ug-aut105-safety-professional-practice',2,'Classify tools, equipment, materials, and energy hazards'),
  ('ug-aut105-safety-professional-practice',3,'Locate applicable safety and environmental information'),
  ('ug-aut105-safety-professional-practice',4,'Establish safe work boundaries'),
  ('ug-aut105-safety-professional-practice',5,'Recognize high-voltage and stored-energy escalation points'),
  ('ug-aut105-safety-professional-practice',6,'Document conditions and controls'),
  ('ug-aut105-safety-professional-practice',7,'Practice a stop-work or escalation decision'),
  ('ug-aut105-safety-professional-practice',8,'Explain and verify the professional next step')
on conflict (lesson_plan_id, position) do update set
  step_text = excluded.step_text;

commit;
