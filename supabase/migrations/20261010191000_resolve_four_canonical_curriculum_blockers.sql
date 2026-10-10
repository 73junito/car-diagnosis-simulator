begin;

insert into public.curriculum_courses (id, program_id, academic_level, cip_code, title, status) values
  ('aut-150','automotive-technology','undergraduate','47.0604','Steering, Suspension, and Wheel Alignment','planned'),
  ('aut-210','automotive-technology','undergraduate','47.0604','Engine Performance and Fuel Systems','planned'),
  ('aut-330','automotive-technology','undergraduate','47.0604','Electric Vehicle Technology','planned'),
  ('aut-525','automotive-engineering-technology','graduate','15.0803','Experimental Methods in Automotive Technology','planned')
on conflict (id) do update set
  program_id=excluded.program_id,
  academic_level=excluded.academic_level,
  cip_code=excluded.cip_code,
  title=excluded.title,
  status=excluded.status,
  updated_at=now();

insert into public.curriculum_competencies (id, course_id, academic_level, competency_area_id, statement, status) values
  ('ug-aut150-steering-suspension-alignment','aut-150','undergraduate',null,'Analyze steering, suspension, tire-wear, wheel-alignment, electric power steering, and vehicle-stability evidence to justify a safe next diagnostic or service step while preserving vehicle-specific specification and procedure boundaries.','planned'),
  ('ug-aut210-engine-performance-fuel-systems','aut-210','undergraduate',null,'Interpret fuel, ignition, air-induction, throttle-control, sensor, actuator, and engine-operating evidence to distinguish observations from hypotheses and justify a source-controlled next diagnostic step.','planned'),
  ('ug-aut330-electric-vehicle-technology','aut-330','undergraduate',null,'Analyze battery-electric vehicle architecture, traction energy flow, motors, inverters, charging, regenerative braking, thermal management, and diagnostic evidence while maintaining high-voltage and vehicle-specific service-information boundaries.','planned'),
  ('grad-aut525-experimental-methods','aut-525','graduate',null,'Design and critique automotive experiments using explicit objectives, instrumentation, controls, data acquisition, uncertainty analysis, repeatability, validation, and technically defensible reporting.','planned')
on conflict (id) do update set
  course_id=excluded.course_id,
  academic_level=excluded.academic_level,
  competency_area_id=excluded.competency_area_id,
  statement=excluded.statement,
  status=excluded.status,
  updated_at=now();

insert into public.curriculum_lesson_plans (id, course_id, competency_id, academic_level, title, status) values
  ('ug-aut150-steering-suspension-alignment','aut-150','ug-aut150-steering-suspension-alignment','undergraduate','Steering, Suspension, Alignment, and Stability Evidence','planned'),
  ('ug-aut210-engine-performance-fuel-systems','aut-210','ug-aut210-engine-performance-fuel-systems','undergraduate','Engine Performance, Fuel, Ignition, and Control-System Evidence','planned'),
  ('ug-aut330-electric-vehicle-technology','aut-330','ug-aut330-electric-vehicle-technology','undergraduate','Battery-Electric Vehicle Architecture, Energy Flow, and Diagnostic Evidence','planned'),
  ('grad-aut525-experimental-methods','aut-525','grad-aut525-experimental-methods','graduate','Automotive Experimental Design, Measurement, Uncertainty, and Validation','planned')
on conflict (id) do update set
  course_id=excluded.course_id,
  competency_id=excluded.competency_id,
  academic_level=excluded.academic_level,
  title=excluded.title,
  status=excluded.status,
  updated_at=now();

delete from public.curriculum_lesson_steps
where lesson_plan_id in (
  'ug-aut150-steering-suspension-alignment',
  'ug-aut210-engine-performance-fuel-systems',
  'ug-aut330-electric-vehicle-technology',
  'grad-aut525-experimental-methods'
);

insert into public.curriculum_lesson_steps (lesson_plan_id, position, step_text) values
  ('ug-aut150-steering-suspension-alignment',1,'Establish steering suspension and alignment safety boundaries'),
  ('ug-aut150-steering-suspension-alignment',2,'Identify steering and suspension system roles'),
  ('ug-aut150-steering-suspension-alignment',3,'Relate tire wear to geometry and component condition'),
  ('ug-aut150-steering-suspension-alignment',4,'Interpret camber caster toe and thrust relationships'),
  ('ug-aut150-steering-suspension-alignment',5,'Recognize electric power steering system interactions'),
  ('ug-aut150-steering-suspension-alignment',6,'Connect steering inputs to stability-control context'),
  ('ug-aut150-steering-suspension-alignment',7,'Analyze inspection and alignment evidence'),
  ('ug-aut150-steering-suspension-alignment',8,'Justify a source-controlled next diagnostic or service step'),
  ('ug-aut210-engine-performance-fuel-systems',1,'Define the engine-performance concern and operating context'),
  ('ug-aut210-engine-performance-fuel-systems',2,'Map fuel ignition air and control-system relationships'),
  ('ug-aut210-engine-performance-fuel-systems',3,'Identify sensor and actuator evidence paths'),
  ('ug-aut210-engine-performance-fuel-systems',4,'Interpret operating data without overclaiming causality'),
  ('ug-aut210-engine-performance-fuel-systems',5,'Form competing system-level hypotheses'),
  ('ug-aut210-engine-performance-fuel-systems',6,'Select an evidence-producing diagnostic test'),
  ('ug-aut210-engine-performance-fuel-systems',7,'Compare results with applicable service information'),
  ('ug-aut210-engine-performance-fuel-systems',8,'Document the supported next diagnostic step'),
  ('ug-aut330-electric-vehicle-technology',1,'Establish high-voltage safety and information boundaries'),
  ('ug-aut330-electric-vehicle-technology',2,'Trace battery-electric vehicle energy flow'),
  ('ug-aut330-electric-vehicle-technology',3,'Distinguish low-voltage and high-voltage domains'),
  ('ug-aut330-electric-vehicle-technology',4,'Analyze traction motor inverter and DC/DC roles'),
  ('ug-aut330-electric-vehicle-technology',5,'Relate charging and regenerative-braking energy paths'),
  ('ug-aut330-electric-vehicle-technology',6,'Connect thermal management to battery and power-electronics operation'),
  ('ug-aut330-electric-vehicle-technology',7,'Interpret safe diagnostic evidence and isolation controls'),
  ('ug-aut330-electric-vehicle-technology',8,'Justify a vehicle-specific next diagnostic step'),
  ('grad-aut525-experimental-methods',1,'Define the experimental question and measurable outcome'),
  ('grad-aut525-experimental-methods',2,'Choose instrumentation and measurement architecture'),
  ('grad-aut525-experimental-methods',3,'Establish controls calibration and acquisition conditions'),
  ('grad-aut525-experimental-methods',4,'Plan repeatability reproducibility and uncertainty treatment'),
  ('grad-aut525-experimental-methods',5,'Collect and quality-check experimental data'),
  ('grad-aut525-experimental-methods',6,'Analyze uncertainty and compare competing explanations'),
  ('grad-aut525-experimental-methods',7,'Validate findings against objectives and limitations'),
  ('grad-aut525-experimental-methods',8,'Report methods evidence uncertainty and conclusions');

insert into public.curriculum_reference_mappings (reference_id, lesson_plan_id, role, notes) values
  ('openstax-university-physics-v1-2026','ug-aut150-steering-suspension-alignment','engineering-mechanics-foundation','Reference-only mechanics foundation for force, motion, load transfer, friction, and steering/suspension relationships. Existing noncommercial and no-AI/RAG restrictions remain unchanged.'),
  ('nhtsa-fmvss-126-electronic-stability-control','ug-aut150-steering-suspension-alignment','stability-control-steering-response-reference','Automotive-specific federal stability-control context supports steering input, yaw response, lateral response, and individual-wheel intervention. It does not replace alignment, steering, suspension, or OEM service information.'),
  ('openstax-principles-data-science-2025','ug-aut210-engine-performance-fuel-systems','diagnostic-data-foundation','Reference-only data-science background for operating-data interpretation, comparison, uncertainty, visualization, and evidence-based reasoning. Existing noncommercial and no-AI/RAG controls remain unchanged.'),
  ('automotive-engine-diagnostic-survey-2012','ug-aut210-engine-performance-fuel-systems','automotive-diagnostic-methods-reference','Peer-reviewed automotive-engine diagnostic survey supports fault-detection, fault-isolation, model-based, and data-driven diagnostic context without substituting for current vehicle-specific service information.'),
  ('nhtsa-electric-hybrid-vehicle-safety-2026','ug-aut330-electric-vehicle-technology','high-voltage-safety-reference','Federal electrified-vehicle safety reference supports high-voltage hazard, isolation, emergency, and safe-system-boundary context; it does not replace OEM service procedures or technician qualification requirements.'),
  ('doe-vto-electric-drive-systems-rd','ug-aut330-electric-vehicle-technology','electric-drive-systems-reference','DOE electric-drive systems guidance supports motors, inverters, converters, onboard charging, efficiency, reliability, and integration context while vehicle-specific procedures remain source-controlled.'),
  ('openstax-principles-data-science-2025','grad-aut525-experimental-methods','testing-data-foundation','Reference-only data-science background supports experimental data, visualization, uncertainty, validation, and interpretation. Existing noncommercial and no-AI/RAG restrictions remain unchanged.'),
  ('doe-vto-electric-drive-systems-rd','grad-aut525-experimental-methods','automotive-validation-context-reference','DOE automotive R&D context supports performance, efficiency, reliability, thermal, integration, and validation considerations used when planning advanced vehicle-system experiments.')
on conflict (reference_id, lesson_plan_id, role) do update set
  notes=excluded.notes;

commit;
