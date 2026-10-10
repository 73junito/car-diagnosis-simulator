begin;

insert into public.curriculum_courses (id, program_id, academic_level, cip_code, title, status) values
  ('aut-120','automotive-technology','undergraduate','47.0604','Automotive Electrical Systems I','planned')
on conflict (id) do update set
  program_id=excluded.program_id,
  academic_level=excluded.academic_level,
  cip_code=excluded.cip_code,
  title=excluded.title,
  status=excluded.status,
  updated_at=now();

insert into public.curriculum_competencies (id, course_id, academic_level, competency_area_id, statement, status) values
  ('ug-aut120-electrical-fundamentals','aut-120','undergraduate',null,
   'Explain foundational automotive electrical relationships, interpret generalized circuit measurements, and justify a safe next diagnostic step while distinguishing project-authored training models from vehicle-specific service information.',
   'planned')
on conflict (id) do update set
  course_id=excluded.course_id,
  academic_level=excluded.academic_level,
  competency_area_id=excluded.competency_area_id,
  statement=excluded.statement,
  status=excluded.status,
  updated_at=now();

insert into public.curriculum_lesson_plans (id, course_id, competency_id, academic_level, title, status) values
  ('ug-aut120-electrical-fundamentals','aut-120','ug-aut120-electrical-fundamentals','undergraduate',
   'Automotive Electrical Fundamentals, Circuits, and Testing','planned')
on conflict (id) do update set
  course_id=excluded.course_id,
  competency_id=excluded.competency_id,
  academic_level=excluded.academic_level,
  title=excluded.title,
  status=excluded.status,
  updated_at=now();

delete from public.curriculum_lesson_steps
where lesson_plan_id='ug-aut120-electrical-fundamentals';

insert into public.curriculum_lesson_steps (lesson_plan_id, position, step_text) values
  ('ug-aut120-electrical-fundamentals',1,'Establish electrical safety and information boundaries'),
  ('ug-aut120-electrical-fundamentals',2,'Relate voltage current resistance and power'),
  ('ug-aut120-electrical-fundamentals',3,'Distinguish series parallel and combined circuit relationships'),
  ('ug-aut120-electrical-fundamentals',4,'Identify power protection switching load and ground roles'),
  ('ug-aut120-electrical-fundamentals',5,'Trace generalized automotive circuit paths'),
  ('ug-aut120-electrical-fundamentals',6,'Select measurement points and meter functions conceptually'),
  ('ug-aut120-electrical-fundamentals',7,'Interpret voltage resistance current and voltage-drop evidence'),
  ('ug-aut120-electrical-fundamentals',8,'Diagnose a generalized electrical concern using evidence');

insert into public.curriculum_reference_mappings (reference_id, lesson_plan_id, role, notes) values
  ('fiore-ac-electrical-circuit-analysis-2021','ug-aut120-electrical-fundamentals','electrical-theory-reference',
   'Reference-only circuit-theory foundation for voltage, current, resistance, power, circuit relationships, and measurement reasoning. Noncommercial source restrictions remain unchanged.'),
  ('bosch-alternator-technical-poster-2020','ug-aut120-electrical-fundamentals','automotive-electrical-domain-reference',
   'Automotive-specific electrical-system component context supplements foundational circuit theory. Citation-only and not a substitute for vehicle-specific wiring diagrams, procedures, specifications, or safety information.')
on conflict (reference_id, lesson_plan_id, role) do update set
  notes=excluded.notes;

commit;
