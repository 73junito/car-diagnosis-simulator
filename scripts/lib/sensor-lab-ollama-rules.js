'use strict';

function normalizeQuestionText(question) {
  return [
    question.focus_area,
    question.question,
    question.rationale,
    ...Object.values(question.options || {})
  ].join(' ').toLowerCase();
}

function buildValidBasisIds({ runtime, template, engineering, generationRules }) {
  return new Set([
    ...runtime.toolIds,
    ...runtime.measurementTypes.map((id) => `measurement:${id}`),
    ...template.testPoints.map((item) => item.id),
    ...template.faultCatalog.map((item) => item.id),
    ...template.operatingStates.map((item) => item.id),
    ...engineering.faultBehavior.map((item) => item.faultId),
    'engineering:analog_voltage',
    'engineering:signal_range',
    ...Object.keys(generationRules).map((id) => `rule:${id}`)
  ]);
}

function enforceSensorRules(question) {
  const text = normalizeQuestionText(question);
  const rejectionContext = /not established|does not establish|cannot infer|not supported|avoid assuming|should not assume/.test(text);

  const referencesSensorSignal = /tp_sensor_signal|sensor-side|sensor side/.test(text);
  const referencesEcmSignal = /tp_ecm_signal|controller-observed|controller observed|ecm signal|controller signal/.test(text);
  const referencesShortFault = /short(?:ed)? to ground|short(?:ed)? to (?:power|reference)|fault_signal_short_(?:ground|power)/.test(text);
  const assertsForcedNumeric = /\b0(?:\.0+)?\s*v(?:olts?)?\b|\bzero volts?\b|\b5(?:\.0+)?\s*v(?:olts?)?\b|\bnominal 5 v\b/.test(text);

  if (referencesShortFault && referencesSensorSignal && assertsForcedNumeric && !referencesEcmSignal) {
    throw new Error(`Question ${question.question_id} invents a short-fault numeric effect at TP_SENSOR_SIGNAL.`);
  }

  const frequencyDutyClaim = /frequency|duty[_ -]?cycle|cycles per second/.test(text);
  if (frequencyDutyClaim && !rejectionContext) {
    throw new Error(`Question ${question.question_id} treats generic frequency/duty support as modeled sensor behavior.`);
  }

  const scanToolClaim = /scan[- ]?tool|diagnostic_data|diagnostic data/.test(text);
  const scanSpecificBehavior = /confirm.*sensor.*(?:active|generating)|sensor status|sensor activity|\bpid\b|parameter value/.test(text);
  if (scanToolClaim && scanSpecificBehavior && !rejectionContext) {
    throw new Error(`Question ${question.question_id} invents scan-tool PID or activity semantics.`);
  }

  const groundClaim = /tp_sensor_ground|sensor ground/.test(text);
  const groundNumericOrThreshold = /\b\d+(?:\.\d+)?\s*(?:v|volt|ohm)|high voltage drop|low resistance|acceptable|within spec|pass|fail/.test(text);
  if (groundClaim && groundNumericOrThreshold && !rejectionContext) {
    throw new Error(`Question ${question.question_id} invents a Sensor Lab ground result or threshold.`);
  }

  const continuityProcedure = /continuity/.test(text) && /(check|test|measure|confirm|verify)/.test(text);
  if (continuityProcedure && !/de-energ|isolat/.test(text)) {
    throw new Error(`Question ${question.question_id} omits de-energized/isolated context for continuity testing.`);
  }
}

function validateGeneratedQuestions({ questions, targetCount, validBasisIds }) {
  if (!Array.isArray(questions) || questions.length !== targetCount) {
    throw new Error(`Expected ${targetCount} questions from Ollama.`);
  }

  const ids = new Set();
  for (const question of questions) {
    if (!question.question_id || ids.has(question.question_id)) throw new Error('Question IDs must be unique.');
    ids.add(question.question_id);
    if (!question.question || !question.focus_area || !question.rationale) throw new Error('Question draft is incomplete.');
    if (!question.options || ['A', 'B', 'C', 'D'].some((key) => !question.options[key])) throw new Error('Question options are incomplete.');
    if (!['A', 'B', 'C', 'D'].includes(question.correct_answer)) throw new Error('Invalid correct answer key.');
    if (!Array.isArray(question.basis_ids) || question.basis_ids.length === 0) {
      throw new Error(`Question ${question.question_id} has no evidence basis IDs.`);
    }
    for (const basisId of question.basis_ids) {
      if (!validBasisIds.has(basisId)) throw new Error(`Question ${question.question_id} cites unknown basis ID: ${basisId}`);
    }
    enforceSensorRules(question);
    if (question.status !== 'draft' || question.approved !== false) throw new Error('Question escaped draft-only governance.');
  }
}

module.exports = {
  normalizeQuestionText,
  buildValidBasisIds,
  enforceSensorRules,
  validateGeneratedQuestions
};
