"use strict";

const fs = require("fs");

const policy = JSON.parse(fs.readFileSync("data/curriculum/content-policy.json", "utf8"));
const lessonPlans = JSON.parse(fs.readFileSync("data/curriculum/lesson-plans.json", "utf8")).lessonPlans;
const statusById = new Map(lessonPlans.map((lesson) => [lesson.id, lesson.status]));

const commonStructure = [...policy.lessonStructure];
const evidenceExpectation =
  "Technical claims require approved provenance. Vehicle-specific procedures, values, limits, and specifications require an appropriate authoritative source and must not be invented.";
const assessmentBoundary =
  "Training checks may coach, explain, and allow retry. Scored assessment remains a separate approval state and requires provenance, review status, curriculum mapping, and secure delivery.";

function objective(id, statement, cognitiveLevel) {
  return { id, statement, cognitiveLevel };
}

function block(id, type, instructionalPurpose, title, description, supportsObjectiveIds) {
  return { id, type, instructionalPurpose, title, description, supportsObjectiveIds };
}

function visual(id, type, instructionalPurpose, title, purpose, supportsObjectiveIds) {
  return {
    id, type, instructionalPurpose, title, purpose, supportsObjectiveIds,
    accessibilityTextRequired: true,
    status: "planned"
  };
}

function plan(config) {
  return {
    lessonPlanId: config.id,
    status: statusById.get(config.id),
    lessonSummary: config.summary,
    estimatedMinutes: config.minutes,
    prerequisites: config.prerequisites,
    learningObjectives: config.objectives,
    keyConcepts: config.keyConcepts,
    contentBlocks: config.blocks,
    visuals: config.visuals,
    practiceTasks: config.practiceTasks,
    assessmentPlan: config.assessmentPlan,
    evidenceFocus: config.evidenceFocus,
    evidenceExpectation,
    assessmentBoundary,
    structure: commonStructure,
    structureExceptions: []
  };
}

const plans = [
  plan({
    id: "ug-electrical-charging-system",
    summary: "Build from charging-system relationships to evidence-based diagnostic decisions using symptoms, measurements, and vehicle-specific verification procedures.",
    minutes: 180,
    prerequisites: ["Electrical safety fundamentals", "Basic circuit concepts", "Digital multimeter fundamentals"],
    objectives: [
      objective("ug-electrical-lo-1", "Explain the functional relationship among the battery, alternator, rectifier, voltage regulation, and vehicle electrical loads.", "knowledge"),
      objective("ug-electrical-lo-2", "Interpret charging-system symptoms and measurements as evidence rather than as proof of a component failure.", "evidence-interpretation"),
      objective("ug-electrical-lo-3", "Select and justify a vehicle-specific next diagnostic check using the available evidence.", "diagnostic-reasoning")
    ],
    keyConcepts: ["energy storage and generation", "alternating-to-direct-current conversion", "voltage regulation", "system load", "measurement context", "evidence-to-decision reasoning"],
    blocks: [
      block("charging-objectives", "learning-objective", "introduce", "Lesson targets", "Preview the system-understanding, evidence-interpretation, and diagnostic-reasoning outcomes.", ["ug-electrical-lo-1","ug-electrical-lo-2","ug-electrical-lo-3"]),
      block("charging-prior-knowledge", "prior-knowledge", "introduce", "Prerequisite check", "Activate prior knowledge of circuit behavior, meter use, polarity, and electrical safety.", ["ug-electrical-lo-1"]),
      block("charging-system-model", "concept-explanation", "explain", "Charging-system relationships", "Explain how generation, rectification, regulation, storage, and loads interact as one system.", ["ug-electrical-lo-1"]),
      block("charging-evidence-model", "concept-explanation", "interpret-evidence", "Symptoms are evidence", "Distinguish warning indicators, low-voltage symptoms, and measurements from final diagnostic conclusions.", ["ug-electrical-lo-2"]),
      block("charging-worked-example", "worked-example", "demonstrate", "Worked diagnostic example", "Trace a concern through evidence collection, interpretation, and selection of a next check.", ["ug-electrical-lo-2","ug-electrical-lo-3"]),
      block("charging-guided-practice", "guided-practice", "practice", "Guided evidence sorting", "Classify observations as symptoms, measurements, hypotheses, or verification evidence.", ["ug-electrical-lo-2"]),
      block("charging-independent-scenario", "independent-scenario", "diagnose", "Independent charging concern", "Build and defend a diagnostic plan for a charging-system complaint without being given the answer path.", ["ug-electrical-lo-3"]),
      block("charging-reasoning-check", "knowledge-or-reasoning-check", "assess", "Reasoning check", "Check system relationships, evidence interpretation, and next-step justification.", ["ug-electrical-lo-1","ug-electrical-lo-2","ug-electrical-lo-3"]),
      block("charging-feedback", "feedback-and-retry", "remediate", "Explain and retry", "Provide reasoning-focused feedback and allow the learner to revise the diagnostic decision.", ["ug-electrical-lo-2","ug-electrical-lo-3"]),
      block("charging-evidence-reference", "evidence-reference", "summarize", "Evidence and source boundary", "Identify which claims are general principles and which checks require vehicle-specific authoritative information.", ["ug-electrical-lo-3"]),
      block("charging-summary", "lesson-summary", "summarize", "Diagnostic decision summary", "Summarize the progression from system understanding to evidence-supported verification.", ["ug-electrical-lo-1","ug-electrical-lo-2","ug-electrical-lo-3"])
    ],
    visuals: [
      visual("charging-relationships", "concept-diagram", "explain", "Charging-system relationship map", "Show battery, generation, rectification, regulation, and load relationships.", ["ug-electrical-lo-1"]),
      visual("charging-diagnostic-flow", "flowchart", "sequence", "Evidence-to-next-check flow", "Show a diagnostic process without implying a universal vehicle-specific procedure.", ["ug-electrical-lo-2","ug-electrical-lo-3"]),
      visual("charging-evidence-table", "table", "compare", "Evidence interpretation table", "Compare observation type, possible meaning, limitation, and appropriate next evidence.", ["ug-electrical-lo-2"]),
      visual("charging-measurement-bars", "bar-chart", "interpret-evidence", "Measurement comparison example", "Compare sample measurements across operating conditions as an interpretation exercise.", ["ug-electrical-lo-2"]),
      visual("charging-workflow-summary", "infographic", "summarize", "Charging diagnosis at a glance", "Summarize system, evidence, decision, and verification relationships.", ["ug-electrical-lo-1","ug-electrical-lo-2","ug-electrical-lo-3"])
    ],
    practiceTasks: ["Identify component roles from a system diagram", "Sort evidence from conclusions", "Choose the next information needed in a guided case", "Write a short justification for an independent diagnostic check"],
    assessmentPlan: ["Low-stakes component/function check", "Evidence interpretation check", "Independent diagnostic-reasoning scenario", "Reasoning-focused feedback and retry"],
    evidenceFocus: ["General charging-system principles", "Measurement context", "Vehicle-specific service procedure boundary"]
  }),
  plan({
    id: "ug-brakes-foundations",
    summary: "Develop a structured brake-system diagnostic process that connects inspection findings, measurements, specifications, likely causes, and corrective-action verification.",
    minutes: 180,
    prerequisites: ["Brake-system safety", "Basic hydraulic principles", "Inspection and measurement fundamentals"],
    objectives: [
      objective("ug-brakes-lo-1", "Explain how friction, hydraulic force, mechanical actuation, and system condition influence brake performance.", "knowledge"),
      objective("ug-brakes-lo-2", "Interpret inspection findings and measurements by comparing them with appropriate specifications and operating context.", "evidence-interpretation"),
      objective("ug-brakes-lo-3", "Build and justify a diagnostic and verification plan for a brake-system concern.", "diagnostic-reasoning")
    ],
    keyConcepts: ["friction and force transfer", "hydraulic operation", "wear and condition evidence", "measurement versus specification", "cause versus symptom", "verification after corrective action"],
    blocks: [
      block("brakes-objectives", "learning-objective", "introduce", "Lesson targets", "Preview system, evidence, and diagnostic outcomes.", ["ug-brakes-lo-1","ug-brakes-lo-2","ug-brakes-lo-3"]),
      block("brakes-prior-knowledge", "prior-knowledge", "introduce", "Prerequisite check", "Review brake safety, hydraulic force transfer, and basic measurement practice.", ["ug-brakes-lo-1"]),
      block("brakes-system-model", "concept-explanation", "explain", "Brake-system operation", "Connect driver input, force transfer, friction interfaces, and stopping response.", ["ug-brakes-lo-1"]),
      block("brakes-inspection-evidence", "concept-explanation", "interpret-evidence", "Inspection and measurement evidence", "Distinguish condition observations, measured values, specifications, and diagnostic conclusions.", ["ug-brakes-lo-2"]),
      block("brakes-worked-example", "worked-example", "demonstrate", "Worked brake concern", "Follow an example from complaint through inspection, measurement, comparison, and verification planning.", ["ug-brakes-lo-2","ug-brakes-lo-3"]),
      block("brakes-guided-practice", "guided-practice", "practice", "Evidence comparison practice", "Compare sample findings with supplied specifications and identify what additional evidence is needed.", ["ug-brakes-lo-2"]),
      block("brakes-independent-scenario", "independent-scenario", "diagnose", "Independent brake scenario", "Create a diagnostic plan from a symptom set and inspection evidence.", ["ug-brakes-lo-3"]),
      block("brakes-reasoning-check", "knowledge-or-reasoning-check", "assess", "Brake reasoning check", "Assess system understanding, evidence interpretation, and verification logic.", ["ug-brakes-lo-1","ug-brakes-lo-2","ug-brakes-lo-3"]),
      block("brakes-feedback", "feedback-and-retry", "remediate", "Explain and retry", "Address common confusion between wear evidence, causal evidence, and proof of repair.", ["ug-brakes-lo-2","ug-brakes-lo-3"]),
      block("brakes-evidence-reference", "evidence-reference", "summarize", "Specifications and source boundary", "Reinforce that service limits and procedures require authoritative vehicle-specific information.", ["ug-brakes-lo-2","ug-brakes-lo-3"]),
      block("brakes-summary", "lesson-summary", "summarize", "Brake diagnostic summary", "Summarize inspection, measurement, comparison, diagnosis, and verification.", ["ug-brakes-lo-1","ug-brakes-lo-2","ug-brakes-lo-3"])
    ],
    visuals: [
      visual("brakes-force-path", "concept-diagram", "explain", "Brake force-path diagram", "Show how driver input becomes hydraulic/mechanical force and friction at the wheel.", ["ug-brakes-lo-1"]),
      visual("brakes-diagnostic-flow", "flowchart", "sequence", "Brake evidence workflow", "Sequence concern definition, safety inspection, measurement, comparison, diagnosis, and verification.", ["ug-brakes-lo-2","ug-brakes-lo-3"]),
      visual("brakes-evidence-table", "table", "compare", "Brake evidence table", "Compare symptom, observation, measurement, interpretation, and next evidence.", ["ug-brakes-lo-2"]),
      visual("brakes-measurement-bars", "bar-chart", "interpret-evidence", "Measurement comparison", "Compare sample measured conditions against supplied reference values.", ["ug-brakes-lo-2"])
    ],
    practiceTasks: ["Map brake force transfer", "Classify inspection versus measurement evidence", "Compare supplied measurements with specifications", "Create a verification plan for an independent scenario"],
    assessmentPlan: ["Low-stakes system operation check", "Measurement interpretation exercise", "Independent brake diagnostic plan", "Feedback and revision"],
    evidenceFocus: ["Inspection findings", "Measured condition", "Authoritative specifications", "Post-repair verification"]
  }),
  plan({
    id: "ug-engine-performance-foundations",
    summary: "Use operating data, symptoms, test evidence, and competing hypotheses to make disciplined engine-performance diagnostic decisions.",
    minutes: 210,
    prerequisites: ["Four-stroke engine fundamentals", "Basic electrical/electronic concepts", "Scan-data and measurement fundamentals"],
    objectives: [
      objective("ug-engine-performance-lo-1", "Explain how air, fuel, ignition, mechanical condition, and control inputs interact in engine operation.", "knowledge"),
      objective("ug-engine-performance-lo-2", "Interpret operating data and test results in context without treating a single data point as a diagnosis.", "evidence-interpretation"),
      objective("ug-engine-performance-lo-3", "Compare plausible hypotheses and select a test that best discriminates among them.", "diagnostic-reasoning")
    ],
    keyConcepts: ["system interaction", "operating context", "data patterns", "hypothesis formation", "discriminating tests", "repair verification"],
    blocks: [
      block("performance-objectives", "learning-objective", "introduce", "Lesson targets", "Preview system interaction, data interpretation, and hypothesis-testing outcomes.", ["ug-engine-performance-lo-1","ug-engine-performance-lo-2","ug-engine-performance-lo-3"]),
      block("performance-prior-knowledge", "prior-knowledge", "introduce", "Prerequisite check", "Review engine fundamentals and the difference between sensor data, measurements, and conclusions.", ["ug-engine-performance-lo-1"]),
      block("performance-system-model", "concept-explanation", "explain", "Engine-performance system model", "Connect air, fuel, ignition, mechanical condition, control strategy, and feedback.", ["ug-engine-performance-lo-1"]),
      block("performance-data-context", "concept-explanation", "interpret-evidence", "Reading data in context", "Explain why load, temperature, speed, and operating state matter when interpreting data.", ["ug-engine-performance-lo-2"]),
      block("performance-worked-example", "worked-example", "demonstrate", "Worked hypothesis comparison", "Compare multiple explanations for a concern and select evidence that distinguishes them.", ["ug-engine-performance-lo-2","ug-engine-performance-lo-3"]),
      block("performance-guided-practice", "guided-practice", "practice", "Guided data interpretation", "Interpret a small data set and identify unsupported conclusions.", ["ug-engine-performance-lo-2"]),
      block("performance-independent-scenario", "independent-scenario", "diagnose", "Independent performance concern", "Form competing hypotheses, select a discriminating test, and justify the choice.", ["ug-engine-performance-lo-3"]),
      block("performance-reasoning-check", "knowledge-or-reasoning-check", "assess", "Performance reasoning check", "Assess interaction knowledge, data interpretation, and hypothesis-testing logic.", ["ug-engine-performance-lo-1","ug-engine-performance-lo-2","ug-engine-performance-lo-3"]),
      block("performance-feedback", "feedback-and-retry", "remediate", "Explain and retry", "Correct data-to-diagnosis shortcuts and require a revised evidence-based decision.", ["ug-engine-performance-lo-2","ug-engine-performance-lo-3"]),
      block("performance-evidence-reference", "evidence-reference", "summarize", "Evidence and specification boundary", "Identify when manufacturer procedures, operating ranges, and test criteria are required.", ["ug-engine-performance-lo-2","ug-engine-performance-lo-3"]),
      block("performance-summary", "lesson-summary", "summarize", "Engine-performance summary", "Summarize the cycle of data, hypotheses, testing, interpretation, and verification.", ["ug-engine-performance-lo-1","ug-engine-performance-lo-2","ug-engine-performance-lo-3"])
    ],
    visuals: [
      visual("performance-system-map", "concept-diagram", "explain", "Engine-performance interaction map", "Show how air, fuel, ignition, mechanical condition, and controls interact.", ["ug-engine-performance-lo-1"]),
      visual("performance-hypothesis-flow", "flowchart", "sequence", "Hypothesis-testing flow", "Sequence concern definition, evidence review, hypothesis comparison, test selection, and verification.", ["ug-engine-performance-lo-3"]),
      visual("performance-data-table", "table", "compare", "Operating-data comparison table", "Compare data patterns across operating states and candidate explanations.", ["ug-engine-performance-lo-2"]),
      visual("performance-data-bars", "bar-chart", "interpret-evidence", "Relative data comparison", "Use sample normalized values to practice pattern interpretation without presenting universal specifications.", ["ug-engine-performance-lo-2"])
    ],
    practiceTasks: ["Identify system interactions", "Interpret data within an operating context", "Separate evidence from hypotheses", "Choose a discriminating test for competing explanations"],
    assessmentPlan: ["System-interaction check", "Data interpretation task", "Independent hypothesis-and-test scenario", "Feedback and revised reasoning"],
    evidenceFocus: ["Operating context", "Pattern interpretation", "Competing hypotheses", "Vehicle-specific test criteria"]
  }),
  plan({
    id: "ug-suspension-steering-foundations",
    summary: "Connect steering and suspension relationships, inspection evidence, geometry measurements, and operating symptoms into a defensible diagnostic and verification plan.",
    minutes: 180,
    prerequisites: ["Steering and suspension safety", "Basic chassis geometry", "Inspection and measurement fundamentals"],
    objectives: [
      objective("ug-suspension-steering-lo-1", "Explain how steering, suspension, tires, ride height, and alignment geometry influence vehicle response.", "knowledge"),
      objective("ug-suspension-steering-lo-2", "Interpret inspection and geometry evidence in relation to the reported handling or tire-wear concern.", "evidence-interpretation"),
      objective("ug-suspension-steering-lo-3", "Select and justify the next diagnostic or verification step for a suspension or steering concern.", "diagnostic-reasoning")
    ],
    keyConcepts: ["component relationships", "ride height and geometry", "tire evidence", "inspection evidence", "measurement context", "cause versus effect"],
    blocks: [
      block("suspension-objectives", "learning-objective", "introduce", "Lesson targets", "Preview relationship, evidence, and diagnostic outcomes.", ["ug-suspension-steering-lo-1","ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      block("suspension-prior-knowledge", "prior-knowledge", "introduce", "Prerequisite check", "Review chassis safety, steering/suspension roles, and geometry terminology.", ["ug-suspension-steering-lo-1"]),
      block("suspension-system-model", "concept-explanation", "explain", "Chassis relationship model", "Connect steering input, suspension position, tire contact, and alignment geometry.", ["ug-suspension-steering-lo-1"]),
      block("suspension-evidence-model", "concept-explanation", "interpret-evidence", "Reading chassis evidence", "Distinguish visual inspection, tire-wear patterns, measurements, symptoms, and conclusions.", ["ug-suspension-steering-lo-2"]),
      block("suspension-worked-example", "worked-example", "demonstrate", "Worked handling concern", "Trace an example through inspection, geometry evidence, hypotheses, and verification planning.", ["ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      block("suspension-guided-practice", "guided-practice", "practice", "Guided geometry interpretation", "Compare sample evidence and identify what supports or weakens a proposed cause.", ["ug-suspension-steering-lo-2"]),
      block("suspension-independent-scenario", "independent-scenario", "diagnose", "Independent chassis concern", "Build a diagnostic plan for a handling, steering, or tire-wear concern.", ["ug-suspension-steering-lo-3"]),
      block("suspension-reasoning-check", "knowledge-or-reasoning-check", "assess", "Chassis reasoning check", "Assess system relationships, evidence interpretation, and next-step logic.", ["ug-suspension-steering-lo-1","ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      block("suspension-feedback", "feedback-and-retry", "remediate", "Explain and retry", "Correct unsupported geometry conclusions and require a revised diagnostic decision.", ["ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      block("suspension-evidence-reference", "evidence-reference", "summarize", "Specifications and procedures", "Reinforce the need for vehicle-specific geometry values, inspection criteria, and procedures.", ["ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      block("suspension-summary", "lesson-summary", "summarize", "Chassis diagnostic summary", "Summarize relationships among symptoms, inspection, measurement, diagnosis, and verification.", ["ug-suspension-steering-lo-1","ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"])
    ],
    visuals: [
      visual("suspension-relationship-map", "concept-diagram", "explain", "Steering and suspension relationship map", "Show component, geometry, tire-contact, and vehicle-response relationships.", ["ug-suspension-steering-lo-1"]),
      visual("suspension-diagnostic-flow", "flowchart", "sequence", "Chassis evidence workflow", "Sequence concern definition, inspection, measurement, interpretation, diagnosis, and verification.", ["ug-suspension-steering-lo-2","ug-suspension-steering-lo-3"]),
      visual("suspension-evidence-table", "table", "compare", "Chassis evidence table", "Compare symptom, observed condition, geometry evidence, limitations, and next evidence.", ["ug-suspension-steering-lo-2"]),
      visual("suspension-timeline", "timeline", "sequence", "Condition-to-verification timeline", "Show how inspection and measurements progress from initial concern through verification.", ["ug-suspension-steering-lo-3"])
    ],
    practiceTasks: ["Map chassis component relationships", "Interpret supplied geometry and tire evidence", "Identify unsupported causal claims", "Build and defend a diagnostic sequence"],
    assessmentPlan: ["System-relationship check", "Geometry evidence interpretation", "Independent chassis scenario", "Feedback and revised verification plan"],
    evidenceFocus: ["Inspection evidence", "Geometry measurements", "Tire/handling symptoms", "Vehicle-specific alignment criteria"]
  }),
  plan({
    id: "grad-diagnostic-evidence-analysis",
    summary: "Evaluate complex diagnostic evidence by comparing competing hypotheses, measurement uncertainty, source quality, and verification strategies.",
    minutes: 240,
    prerequisites: ["Undergraduate diagnostic reasoning", "Measurement fundamentals", "Technical source evaluation"],
    objectives: [
      objective("grad-diagnostic-lo-1", "Frame a complex diagnostic problem as competing, testable hypotheses rather than a single assumed cause.", "analysis"),
      objective("grad-diagnostic-lo-2", "Evaluate technical evidence and measurement uncertainty for relevance, quality, and discriminating value.", "evidence-interpretation"),
      objective("grad-diagnostic-lo-3", "Design and defend an efficient verification strategy that could falsify or strengthen competing hypotheses.", "diagnostic-reasoning")
    ],
    keyConcepts: ["problem framing", "competing hypotheses", "measurement uncertainty", "evidence quality", "discriminating evidence", "verification strategy", "defensible conclusion"],
    blocks: [
      block("grad-diagnostic-objectives", "learning-objective", "introduce", "Advanced diagnostic outcomes", "Define expectations for hypothesis framing, uncertainty analysis, and defensible verification.", ["grad-diagnostic-lo-1","grad-diagnostic-lo-2","grad-diagnostic-lo-3"]),
      block("grad-diagnostic-prior", "prior-knowledge", "introduce", "Prior diagnostic reasoning", "Activate prior understanding of diagnostic testing, measurement, and evidence interpretation.", ["grad-diagnostic-lo-1"]),
      block("grad-diagnostic-framework", "concept-explanation", "explain", "Competing-hypothesis framework", "Model diagnostic reasoning as explicit hypotheses, predictions, evidence, and revision.", ["grad-diagnostic-lo-1"]),
      block("grad-diagnostic-uncertainty", "concept-explanation", "interpret-evidence", "Evidence and uncertainty", "Examine repeatability, measurement limitations, source quality, and ambiguity in technical evidence.", ["grad-diagnostic-lo-2"]),
      block("grad-diagnostic-worked", "worked-example", "demonstrate", "Worked complex case", "Compare hypotheses using a staged evidence set and explain why some tests discriminate better than others.", ["grad-diagnostic-lo-1","grad-diagnostic-lo-2","grad-diagnostic-lo-3"]),
      block("grad-diagnostic-guided", "guided-practice", "practice", "Guided evidence weighting", "Rank evidence by relevance and discriminating value while noting uncertainty.", ["grad-diagnostic-lo-2"]),
      block("grad-diagnostic-independent", "independent-scenario", "diagnose", "Independent advanced diagnosis", "Develop competing hypotheses, a test strategy, and a defended conclusion for a complex case.", ["grad-diagnostic-lo-3"]),
      block("grad-diagnostic-check", "knowledge-or-reasoning-check", "assess", "Advanced reasoning check", "Assess hypothesis quality, uncertainty interpretation, and verification design.", ["grad-diagnostic-lo-1","grad-diagnostic-lo-2","grad-diagnostic-lo-3"]),
      block("grad-diagnostic-feedback", "feedback-and-retry", "remediate", "Critique and revision", "Provide critique focused on unsupported inference, weak discrimination, and unaddressed uncertainty.", ["grad-diagnostic-lo-2","grad-diagnostic-lo-3"]),
      block("grad-diagnostic-evidence", "evidence-reference", "summarize", "Technical evidence record", "Document the source, role, limitation, and use of each major piece of evidence.", ["grad-diagnostic-lo-2","grad-diagnostic-lo-3"]),
      block("grad-diagnostic-summary", "lesson-summary", "reflect", "Defend the conclusion", "Summarize how the final conclusion follows from the evidence and what uncertainty remains.", ["grad-diagnostic-lo-1","grad-diagnostic-lo-2","grad-diagnostic-lo-3"])
    ],
    visuals: [
      visual("grad-diagnostic-hypothesis-map", "concept-diagram", "explain", "Competing-hypothesis map", "Show relationships among observations, hypotheses, predictions, tests, and conclusions.", ["grad-diagnostic-lo-1"]),
      visual("grad-diagnostic-decision-flow", "flowchart", "sequence", "Advanced verification flow", "Model evidence-driven branching and hypothesis revision.", ["grad-diagnostic-lo-1","grad-diagnostic-lo-3"]),
      visual("grad-diagnostic-evidence-matrix", "table", "compare", "Evidence-weighting matrix", "Compare source quality, relevance, uncertainty, and discriminating value.", ["grad-diagnostic-lo-2"]),
      visual("grad-diagnostic-uncertainty-bars", "bar-chart", "interpret-evidence", "Uncertainty comparison", "Compare illustrative uncertainty ranges or confidence in alternative measurements.", ["grad-diagnostic-lo-2"])
    ],
    practiceTasks: ["Rewrite an assumed diagnosis as competing hypotheses", "Rate evidence quality and uncertainty", "Select a discriminating test", "Defend a verification strategy in writing"],
    assessmentPlan: ["Hypothesis-framing critique", "Evidence-quality analysis", "Independent complex diagnostic case", "Written defense and revision"],
    evidenceFocus: ["Technical source quality", "Measurement uncertainty", "Discriminating evidence", "Traceable diagnostic argument"]
  }),
  plan({
    id: "grad-vehicle-systems-testing",
    summary: "Design controlled vehicle-system tests by defining objectives, selecting instrumentation, controlling variables, analyzing uncertainty, and reporting reproducible findings.",
    minutes: 240,
    prerequisites: ["Diagnostic instrumentation", "Basic statistics", "Measurement uncertainty fundamentals"],
    objectives: [
      objective("grad-testing-lo-1", "Define a testable vehicle-system question with measurable variables and acceptance criteria.", "application"),
      objective("grad-testing-lo-2", "Design a controlled measurement plan using appropriate instrumentation, controls, and repeatable procedures.", "analysis"),
      objective("grad-testing-lo-3", "Analyze results and uncertainty to determine what the test supports, does not support, and should be tested next.", "evaluation")
    ],
    keyConcepts: ["test objective", "variables and controls", "instrument selection", "repeatability", "measurement uncertainty", "data integrity", "technical reporting"],
    blocks: [
      block("grad-testing-objectives", "learning-objective", "introduce", "Testing outcomes", "Define expectations for experimental design, measurement, and interpretation.", ["grad-testing-lo-1","grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-prior", "prior-knowledge", "introduce", "Measurement readiness", "Review instrumentation limits, units, uncertainty, and safe data collection.", ["grad-testing-lo-2"]),
      block("grad-testing-design", "concept-explanation", "explain", "Controlled test design", "Explain variables, controls, repeatability, criteria, and data integrity.", ["grad-testing-lo-1","grad-testing-lo-2"]),
      block("grad-testing-instrumentation", "concept-explanation", "compare", "Instrumentation tradeoffs", "Compare instrument capability, resolution, sampling needs, and limitations.", ["grad-testing-lo-2"]),
      block("grad-testing-worked", "worked-example", "demonstrate", "Worked systems test", "Walk through objective definition, instrument choice, data collection, uncertainty, and conclusion.", ["grad-testing-lo-1","grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-guided", "guided-practice", "practice", "Test-plan critique", "Identify uncontrolled variables and weak measurement choices in a sample test design.", ["grad-testing-lo-2"]),
      block("grad-testing-independent", "independent-scenario", "practice", "Independent test design", "Design a reproducible vehicle-system test and define how results will be interpreted.", ["grad-testing-lo-1","grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-check", "knowledge-or-reasoning-check", "assess", "Test-design check", "Assess controls, instrumentation, uncertainty, and interpretation boundaries.", ["grad-testing-lo-1","grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-feedback", "feedback-and-retry", "remediate", "Design revision", "Revise a test plan after feedback on validity, repeatability, and uncertainty.", ["grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-evidence", "evidence-reference", "summarize", "Methods and evidence record", "Record procedures, instrument assumptions, data transformations, and source references.", ["grad-testing-lo-2","grad-testing-lo-3"]),
      block("grad-testing-summary", "lesson-summary", "reflect", "Reproducible findings", "Summarize what the test supports and the limits of generalization.", ["grad-testing-lo-3"])
    ],
    visuals: [
      visual("grad-testing-design-map", "concept-diagram", "explain", "Controlled-test model", "Show relationships among question, variables, controls, instrumentation, data, and inference.", ["grad-testing-lo-1","grad-testing-lo-2"]),
      visual("grad-testing-process", "flowchart", "sequence", "Vehicle-system test workflow", "Sequence objective, setup, control, collection, analysis, and reporting.", ["grad-testing-lo-1","grad-testing-lo-2"]),
      visual("grad-testing-instrument-table", "table", "compare", "Instrumentation comparison", "Compare measurement capabilities and limitations for a planned test.", ["grad-testing-lo-2"]),
      visual("grad-testing-results-bars", "bar-chart", "interpret-evidence", "Replicate comparison", "Compare repeated illustrative measurements and associated variability.", ["grad-testing-lo-3"])
    ],
    practiceTasks: ["Define variables and criteria", "Critique an instrumentation choice", "Identify uncontrolled variables", "Design and defend a reproducible test plan"],
    assessmentPlan: ["Test-objective check", "Instrumentation/control critique", "Independent experimental design", "Technical report with uncertainty statement"],
    evidenceFocus: ["Methods transparency", "Instrument limitations", "Repeatability", "Uncertainty-aware interpretation"]
  }),
  plan({
    id: "grad-curriculum-assessment-design",
    summary: "Design technical curriculum and assessment systems in which outcomes, learning activities, authentic tasks, rubrics, feedback, and evidence all align.",
    minutes: 240,
    prerequisites: ["Learning-objective fundamentals", "Basic assessment concepts", "Technical-task analysis"],
    objectives: [
      objective("grad-curriculum-lo-1", "Translate a technical competency into measurable learning outcomes at an appropriate cognitive level.", "application"),
      objective("grad-curriculum-lo-2", "Design authentic learning and assessment tasks that generate evidence aligned with the intended outcome.", "analysis"),
      objective("grad-curriculum-lo-3", "Evaluate alignment among outcomes, instruction, assessment criteria, feedback, and evidence of learning.", "evaluation")
    ],
    keyConcepts: ["constructive alignment", "measurable outcomes", "authentic assessment", "rubric criteria", "feedback loops", "valid evidence of learning", "assessment fairness"],
    blocks: [
      block("grad-curriculum-objectives", "learning-objective", "introduce", "Curriculum-design outcomes", "Define expectations for outcome writing, task design, and alignment evaluation.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"]),
      block("grad-curriculum-prior", "prior-knowledge", "introduce", "Prior curriculum knowledge", "Review competency statements, cognitive levels, and assessment terminology.", ["grad-curriculum-lo-1"]),
      block("grad-curriculum-alignment", "concept-explanation", "explain", "Alignment model", "Connect competencies, objectives, instruction, practice, assessment, feedback, and evidence.", ["grad-curriculum-lo-1","grad-curriculum-lo-3"]),
      block("grad-curriculum-authenticity", "concept-explanation", "compare", "Authentic task design", "Distinguish recall checks from performance tasks and diagnostic-reasoning assessments.", ["grad-curriculum-lo-2"]),
      block("grad-curriculum-worked", "worked-example", "demonstrate", "Worked curriculum map", "Transform a technical competency into outcomes, activities, an assessment task, and rubric evidence.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"]),
      block("grad-curriculum-guided", "guided-practice", "practice", "Alignment critique", "Identify misalignment in a sample lesson and redesign the weak element.", ["grad-curriculum-lo-3"]),
      block("grad-curriculum-independent", "independent-scenario", "practice", "Independent curriculum design", "Create a compact aligned lesson-and-assessment plan for a technical competency.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"]),
      block("grad-curriculum-check", "knowledge-or-reasoning-check", "assess", "Alignment reasoning check", "Assess outcome quality, task authenticity, rubric alignment, and evidence sufficiency.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"]),
      block("grad-curriculum-feedback", "feedback-and-retry", "remediate", "Design revision", "Revise outcomes or assessments after feedback about alignment and evidence quality.", ["grad-curriculum-lo-2","grad-curriculum-lo-3"]),
      block("grad-curriculum-evidence", "evidence-reference", "summarize", "Design rationale", "Document the rationale linking the competency, outcome, task, criteria, and evidence.", ["grad-curriculum-lo-3"]),
      block("grad-curriculum-summary", "lesson-summary", "reflect", "Alignment summary", "Summarize the design decisions and remaining limitations.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"])
    ],
    visuals: [
      visual("grad-curriculum-alignment-map", "concept-diagram", "explain", "Curriculum alignment map", "Show competency-to-objective-to-learning-to-assessment-to-evidence relationships.", ["grad-curriculum-lo-1","grad-curriculum-lo-3"]),
      visual("grad-curriculum-design-flow", "flowchart", "sequence", "Curriculum design workflow", "Sequence analysis, outcome design, instruction, assessment, feedback, and evaluation.", ["grad-curriculum-lo-1","grad-curriculum-lo-2"]),
      visual("grad-curriculum-task-table", "table", "compare", "Assessment-method comparison", "Compare recall, application, performance, and reasoning tasks against intended outcomes.", ["grad-curriculum-lo-2"]),
      visual("grad-curriculum-summary-infographic", "infographic", "summarize", "Alignment at a glance", "Summarize the complete aligned curriculum-design cycle.", ["grad-curriculum-lo-1","grad-curriculum-lo-2","grad-curriculum-lo-3"])
    ],
    practiceTasks: ["Rewrite an unmeasurable objective", "Match assessment methods to cognitive levels", "Critique a misaligned rubric", "Build a compact curriculum alignment map"],
    assessmentPlan: ["Outcome-writing check", "Alignment critique", "Independent authentic assessment design", "Design rationale and revision"],
    evidenceFocus: ["Alignment evidence", "Assessment validity", "Transparent criteria", "Feedback as instructional evidence"]
  }),
  plan({
    id: "grad-applied-research-literature",
    summary: "Develop a transparent applied-research evidence workflow from question formulation and scholarly discovery through canonical source resolution, appraisal, claim mapping, and provenance.",
    minutes: 240,
    prerequisites: ["Research-question fundamentals", "Basic source evaluation", "Academic citation fundamentals"],
    objectives: [
      objective("grad-research-lo-1", "Formulate a focused applied research question with concepts that can guide scholarly discovery.", "application"),
      objective("grad-research-lo-2", "Use scholarly discovery to locate candidate evidence and resolve each useful record to a canonical DOI, publisher, government, or institutional source when available.", "evidence-interpretation"),
      objective("grad-research-lo-3", "Evaluate relevance, methods, limitations, and provenance before mapping evidence to a specific claim.", "evaluation")
    ],
    keyConcepts: ["research-question scope", "scholarly discovery", "canonical source resolution", "method appraisal", "claim-evidence fit", "provenance", "citation integrity"],
    blocks: [
      block("grad-research-objectives", "learning-objective", "introduce", "Research-evidence outcomes", "Define expectations for discovery, canonical resolution, appraisal, and provenance.", ["grad-research-lo-1","grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-prior", "prior-knowledge", "introduce", "Prior research knowledge", "Review research questions, keywords, source types, and citation components.", ["grad-research-lo-1"]),
      block("grad-research-question", "concept-explanation", "explain", "Question-to-search model", "Translate an applied problem into searchable concepts and inclusion boundaries.", ["grad-research-lo-1"]),
      block("grad-research-source-chain", "concept-explanation", "sequence", "Discovery to canonical source", "Distinguish discovery tools from canonical evidence records and document the resolution path.", ["grad-research-lo-2"]),
      block("grad-research-worked", "worked-example", "demonstrate", "Worked evidence trace", "Follow a candidate scholarly record through source resolution, appraisal, claim mapping, and provenance documentation.", ["grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-guided", "guided-practice", "practice", "Guided source appraisal", "Compare candidate sources for relevance, method quality, limitations, and claim fit.", ["grad-research-lo-3"]),
      block("grad-research-independent", "independent-scenario", "practice", "Independent evidence search", "Build a small evidence set for an applied question and document the canonical source trail.", ["grad-research-lo-1","grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-check", "knowledge-or-reasoning-check", "assess", "Research reasoning check", "Assess source resolution, appraisal, claim-evidence fit, and provenance decisions.", ["grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-feedback", "feedback-and-retry", "remediate", "Evidence-set revision", "Correct weak source choices, unsupported claims, or incomplete provenance.", ["grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-evidence", "evidence-reference", "summarize", "Provenance record", "Document discovery route, canonical location, citation, appraisal notes, and supported claim.", ["grad-research-lo-2","grad-research-lo-3"]),
      block("grad-research-summary", "lesson-summary", "reflect", "Evidence workflow summary", "Summarize the defensible chain from question to evidence-supported claim.", ["grad-research-lo-1","grad-research-lo-2","grad-research-lo-3"])
    ],
    visuals: [
      visual("grad-research-workflow", "flowchart", "sequence", "Research evidence workflow", "Show question, scholarly discovery, canonical resolution, appraisal, claim mapping, and provenance.", ["grad-research-lo-1","grad-research-lo-2","grad-research-lo-3"]),
      visual("grad-research-source-map", "concept-diagram", "explain", "Source-resolution map", "Distinguish discovery indexes from canonical publishers, repositories, and primary sources.", ["grad-research-lo-2"]),
      visual("grad-research-appraisal-table", "table", "compare", "Evidence appraisal table", "Compare relevance, methods, limitations, source authority, and claim fit.", ["grad-research-lo-3"]),
      visual("grad-research-provenance-timeline", "timeline", "sequence", "Evidence provenance timeline", "Show the trace from discovery through retrieval, appraisal, use, and citation validation.", ["grad-research-lo-2","grad-research-lo-3"])
    ],
    practiceTasks: ["Decompose a research question into searchable concepts", "Resolve a discovery record to a canonical source", "Compare methods and limitations", "Map evidence to a narrowly stated claim"],
    assessmentPlan: ["Research-question check", "Canonical-source resolution exercise", "Independent evidence appraisal", "Provenance-complete claim-evidence map"],
    evidenceFocus: ["Canonical source identity", "Methods and limitations", "Claim-evidence fit", "Transparent provenance"]
  }),
  plan({
    id: "grad-technical-instructional-leadership",
    summary: "Use evidence, stakeholder perspectives, implementation planning, and outcome evaluation to lead improvement in technical programs and instruction.",
    minutes: 240,
    prerequisites: ["Technical-program experience", "Basic leadership concepts", "Program evaluation fundamentals"],
    objectives: [
      objective("grad-leadership-lo-1", "Diagnose a technical-program or instructional challenge using evidence, stakeholder perspectives, and system context.", "analysis"),
      objective("grad-leadership-lo-2", "Design an improvement strategy that distinguishes technical fixes from adaptive or organizational work.", "application"),
      objective("grad-leadership-lo-3", "Define implementation, communication, and evaluation measures that can show whether the improvement is producing the intended outcome.", "evaluation")
    ],
    keyConcepts: ["system diagnosis", "stakeholder analysis", "technical versus adaptive work", "implementation planning", "communication", "productive feedback", "program evaluation"],
    blocks: [
      block("grad-leadership-objectives", "learning-objective", "introduce", "Leadership outcomes", "Define expectations for diagnosis, improvement design, implementation, and evaluation.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"]),
      block("grad-leadership-prior", "prior-knowledge", "introduce", "Prior leadership knowledge", "Review system context, stakeholder roles, and evidence used in program decisions.", ["grad-leadership-lo-1"]),
      block("grad-leadership-diagnosis", "concept-explanation", "explain", "Diagnose before acting", "Frame program challenges through evidence, system conditions, stakeholder perspectives, and perceived losses.", ["grad-leadership-lo-1"]),
      block("grad-leadership-change", "concept-explanation", "compare", "Technical and adaptive work", "Compare problems that can be solved by expertise with those requiring learning, behavior, or cultural change.", ["grad-leadership-lo-2"]),
      block("grad-leadership-worked", "worked-example", "demonstrate", "Worked program-improvement case", "Trace a technical-program challenge through diagnosis, stakeholder engagement, strategy design, implementation, and evaluation.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"]),
      block("grad-leadership-guided", "guided-practice", "practice", "Stakeholder and risk analysis", "Identify stakeholders, likely concerns, evidence needs, and implementation risks for a sample change.", ["grad-leadership-lo-1","grad-leadership-lo-2"]),
      block("grad-leadership-independent", "independent-scenario", "practice", "Independent improvement plan", "Design an evidence-informed improvement plan for a technical instructional context.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"]),
      block("grad-leadership-check", "knowledge-or-reasoning-check", "assess", "Leadership reasoning check", "Assess diagnosis quality, strategy fit, stakeholder logic, and evaluation design.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"]),
      block("grad-leadership-feedback", "feedback-and-retry", "remediate", "Plan revision", "Revise the improvement plan after feedback on diagnosis, feasibility, communication, or outcome measures.", ["grad-leadership-lo-2","grad-leadership-lo-3"]),
      block("grad-leadership-evidence", "evidence-reference", "summarize", "Evidence and decision record", "Document evidence used, stakeholder input, decisions, assumptions, and evaluation measures.", ["grad-leadership-lo-1","grad-leadership-lo-3"]),
      block("grad-leadership-summary", "lesson-summary", "reflect", "Leadership reflection", "Summarize the logic of the intervention, what will be monitored, and what would trigger revision.", ["grad-leadership-lo-2","grad-leadership-lo-3"])
    ],
    visuals: [
      visual("grad-leadership-system-map", "concept-diagram", "explain", "Program-system map", "Show relationships among learners, instructors, leaders, curriculum, resources, policy, and outcomes.", ["grad-leadership-lo-1"]),
      visual("grad-leadership-change-flow", "flowchart", "sequence", "Improvement process", "Sequence diagnosis, stakeholder engagement, strategy, implementation, monitoring, and revision.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"]),
      visual("grad-leadership-stakeholder-table", "table", "compare", "Stakeholder analysis table", "Compare roles, concerns, influence, evidence needs, and engagement strategies.", ["grad-leadership-lo-1","grad-leadership-lo-2"]),
      visual("grad-leadership-implementation-timeline", "timeline", "sequence", "Implementation timeline", "Show staged communication, implementation, monitoring, and evaluation milestones.", ["grad-leadership-lo-3"]),
      visual("grad-leadership-summary-infographic", "infographic", "summarize", "Evidence-informed leadership cycle", "Summarize diagnose, engage, design, implement, evaluate, and adapt.", ["grad-leadership-lo-1","grad-leadership-lo-2","grad-leadership-lo-3"])
    ],
    practiceTasks: ["Diagnose a program challenge from mixed evidence", "Classify technical versus adaptive elements", "Build a stakeholder-engagement plan", "Define measurable implementation and outcome indicators"],
    assessmentPlan: ["System-diagnosis critique", "Stakeholder strategy exercise", "Independent program-improvement plan", "Evaluation rationale and reflective revision"],
    evidenceFocus: ["Program evidence", "Stakeholder input", "Implementation assumptions", "Outcome and process measures"]
  })
];

for (const item of plans) {
  if (!item.contentBlocks.some((block) => block.type === "visual-or-model")) {
    const candidate = item.contentBlocks.find(
      (block, index) => index > 1 && block.type === "concept-explanation"
    );
    if (!candidate) {
      throw new Error(`Unable to assign visual-or-model block for ${item.lessonPlanId}`);
    }
    candidate.type = "visual-or-model";
  }
}

const output = { schemaVersion: "1.1.0", lessonContentPlans: plans };
fs.writeFileSync("data/curriculum/lesson-content.json", JSON.stringify(output, null, 2) + "\n");

console.log(
  `[PASS] Expanded ${plans.length} lesson content plans with ` +
  `${plans.reduce((sum, item) => sum + item.learningObjectives.length, 0)} objectives, ` +
  `${plans.reduce((sum, item) => sum + item.contentBlocks.length, 0)} content blocks, and ` +
  `${plans.reduce((sum, item) => sum + item.visuals.length, 0)} planned visuals`
);
