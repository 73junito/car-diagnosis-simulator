begin;

insert into public.curriculum_courses (id, program_id, academic_level, cip_code, title, status) values
  ('aut-400','automotive-technology','undergraduate','47.0604','Automotive Technology Research Methods','planned'),
  ('aut-410','automotive-technology','undergraduate','47.0604','Automotive Systems Integration','planned'),
  ('aut-420','automotive-technology','undergraduate','47.0604','Automotive Technology Internship','planned'),
  ('aut-450','automotive-technology','undergraduate','47.0604','Automotive Technology Capstone I','planned'),
  ('aut-451','automotive-technology','undergraduate','47.0604','Automotive Technology Capstone II','planned')
on conflict (id) do update set program_id=excluded.program_id, academic_level=excluded.academic_level, cip_code=excluded.cip_code, title=excluded.title, status=excluded.status, updated_at=now();

insert into public.curriculum_competencies (id, course_id, academic_level, competency_area_id, statement, status) values
  ('ug-aut400-research-methods','aut-400','undergraduate',null,'Formulate an automotive technology research question, organize appropriate evidence and methods, and distinguish source-supported findings from assumptions or unsupported conclusions.','planned'),
  ('ug-aut410-systems-integration','aut-410','undergraduate',null,'Analyze cross-domain vehicle-system dependencies, identify interface evidence, and justify an integration or diagnostic next step using applicable technical information.','planned'),
  ('ug-aut420-professional-internship','aut-420','undergraduate',null,'Document supervised professional learning, connect workplace experiences to curriculum competencies, and communicate evidence of growth while respecting organizational safety, confidentiality, and authorization boundaries.','planned'),
  ('ug-aut450-capstone-planning','aut-450','undergraduate',null,'Define an applied automotive technology problem, justify project requirements and methodology with evidence, and produce a traceable project plan with explicit assumptions, constraints, and verification needs.','planned'),
  ('ug-aut451-capstone-completion','aut-451','undergraduate',null,'Execute and document an approved automotive technology project, evaluate test evidence against project requirements, explain limitations, and present conclusions that are traceable to verified results.','planned')
on conflict (id) do update set course_id=excluded.course_id, academic_level=excluded.academic_level, competency_area_id=excluded.competency_area_id, statement=excluded.statement, status=excluded.status, updated_at=now();

insert into public.curriculum_lesson_plans (id, course_id, competency_id, academic_level, title, status) values
  ('ug-aut400-research-methods','aut-400','ug-aut400-research-methods','undergraduate','Automotive Research Questions, Methods, and Evidence','planned'),
  ('ug-aut410-systems-integration','aut-410','ug-aut410-systems-integration','undergraduate','Integrated Vehicle Systems and Cross-Domain Reasoning','planned'),
  ('ug-aut420-internship','aut-420','ug-aut420-professional-internship','undergraduate','Automotive Professional Experience, Documentation, and Reflection','planned'),
  ('ug-aut450-capstone-i','aut-450','ug-aut450-capstone-planning','undergraduate','Automotive Capstone Problem Definition, Research, and Project Planning','planned'),
  ('ug-aut451-capstone-ii','aut-451','ug-aut451-capstone-completion','undergraduate','Automotive Capstone Completion, Testing, Documentation, and Presentation','planned')
on conflict (id) do update set course_id=excluded.course_id, competency_id=excluded.competency_id, academic_level=excluded.academic_level, title=excluded.title, status=excluded.status, updated_at=now();

insert into public.curriculum_lesson_steps (lesson_plan_id, position, step_text) values
  ('ug-aut400-research-methods',1,'Define the research problem'),
  ('ug-aut400-research-methods',2,'Formulate a focused research question'),
  ('ug-aut400-research-methods',3,'Plan a literature review'),
  ('ug-aut400-research-methods',4,'Select an appropriate research or experimental design'),
  ('ug-aut400-research-methods',5,'Define data-collection needs'),
  ('ug-aut400-research-methods',6,'Plan analysis and interpretation'),
  ('ug-aut400-research-methods',7,'Organize technical writing and presentation'),
  ('ug-aut400-research-methods',8,'Document provenance limitations and next steps'),
  ('ug-aut410-systems-integration',1,'Define the integrated vehicle function'),
  ('ug-aut410-systems-integration',2,'Map participating system domains'),
  ('ug-aut410-systems-integration',3,'Identify interfaces and dependencies'),
  ('ug-aut410-systems-integration',4,'Trace information energy and control flow'),
  ('ug-aut410-systems-integration',5,'Organize cross-domain evidence'),
  ('ug-aut410-systems-integration',6,'Identify applicable architecture information'),
  ('ug-aut410-systems-integration',7,'Practice an integration reasoning scenario'),
  ('ug-aut410-systems-integration',8,'Document the system-level verification plan'),
  ('ug-aut420-internship',1,'Clarify the supervised experience context'),
  ('ug-aut420-internship',2,'Define learning goals with the approved supervisor or program'),
  ('ug-aut420-internship',3,'Identify professional and safety expectations'),
  ('ug-aut420-internship',4,'Document authorized work and observations'),
  ('ug-aut420-internship',5,'Connect experiences to curriculum competencies'),
  ('ug-aut420-internship',6,'Reflect on evidence of learning'),
  ('ug-aut420-internship',7,'Prepare professional communication or artifacts'),
  ('ug-aut420-internship',8,'Document outcomes and next development goals'),
  ('ug-aut450-capstone-i',1,'Define the capstone problem'),
  ('ug-aut450-capstone-i',2,'Identify stakeholders and context'),
  ('ug-aut450-capstone-i',3,'Review relevant evidence and prior work'),
  ('ug-aut450-capstone-i',4,'Develop project requirements'),
  ('ug-aut450-capstone-i',5,'Select and justify a methodology'),
  ('ug-aut450-capstone-i',6,'Plan data evidence and verification'),
  ('ug-aut450-capstone-i',7,'Identify constraints risks and dependencies'),
  ('ug-aut450-capstone-i',8,'Document the project plan and review criteria'),
  ('ug-aut451-capstone-ii',1,'Confirm the approved project plan'),
  ('ug-aut451-capstone-ii',2,'Execute the planned project work'),
  ('ug-aut451-capstone-ii',3,'Collect testing and verification evidence'),
  ('ug-aut451-capstone-ii',4,'Compare results with requirements'),
  ('ug-aut451-capstone-ii',5,'Address deviations within approved scope'),
  ('ug-aut451-capstone-ii',6,'Analyze limitations and unresolved questions'),
  ('ug-aut451-capstone-ii',7,'Prepare final technical documentation'),
  ('ug-aut451-capstone-ii',8,'Present results conclusions and future work')
on conflict (lesson_plan_id, position) do update set step_text=excluded.step_text;

commit;
