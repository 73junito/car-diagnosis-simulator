'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceSensorRules, validateGeneratedQuestions } = require('../scripts/lib/sensor-lab-ollama-rules');

function draft(overrides = {}) {
  return {
    question_id: 'sensor-draft-test',
    focus_area: 'Sensor diagnostic reasoning',
    question: 'Which statement is supported by the Sensor Lab model?',
    options: { A: 'Supported statement', B: 'Distractor B', C: 'Distractor C', D: 'Distractor D' },
    correct_answer: 'A',
    rationale: 'The correct answer follows the project-authored model.',
    basis_ids: ['TP_ECM_SIGNAL'],
    status: 'draft',
    approved: false,
    ...overrides
  };
}

test('rejects sensor-side forced short values', () => {
  assert.throws(() => enforceSensorRules(draft({
    question: 'If TP_SENSOR_SIGNAL is shorted to ground, what voltage must it read?',
    options: { A: 'Zero volts', B: '1 V', C: '2 V', D: '5 V' },
    rationale: 'The sensor-side signal is forced to zero volts.'
  })), /TP_SENSOR_SIGNAL/);
});

test('allows explicit controller-observed short behavior', () => {
  assert.doesNotThrow(() => enforceSensorRules(draft({
    question: 'Under FAULT_SIGNAL_SHORT_GROUND, what does the model establish at TP_ECM_SIGNAL?',
    rationale: 'The engineering profile establishes a forced ground state only for the controller-observed signal.'
  })));
});

test('rejects unsupported frequency or duty-cycle behavior', () => {
  assert.throws(() => enforceSensorRules(draft({
    question: 'Which measurement determines this sensor output frequency?',
    rationale: 'The sensor outputs frequency.'
  })), /frequency\/duty/);
});

test('rejects invented scan-tool activity semantics', () => {
  assert.throws(() => enforceSensorRules(draft({
    question: 'Which scan-tool PID confirms that the sensor is actively generating a signal?',
    rationale: 'The scan tool confirms sensor activity.'
  })), /scan-tool PID/);
});

test('rejects invented ground thresholds', () => {
  assert.throws(() => enforceSensorRules(draft({
    question: 'At TP_SENSOR_GROUND, which voltage drop is acceptable?',
    options: { A: '0.1 V', B: '1 V', C: '3 V', D: '5 V' },
    rationale: '0.1 V is within spec.'
  })), /ground result or threshold/);
});

test('requires de-energized or isolated context for continuity procedures', () => {
  assert.throws(() => enforceSensorRules(draft({
    question: 'How should you test continuity at TP_SENSOR_GROUND?',
    rationale: 'Use continuity mode to verify the ground path.'
  })), /de-energized\/isolated/);
});

test('requires basis IDs and draft-only governance', () => {
  const validBasisIds = new Set(['TP_ECM_SIGNAL']);
  assert.throws(() => validateGeneratedQuestions({
    questions: [draft({ basis_ids: [] })],
    targetCount: 1,
    validBasisIds
  }), /no evidence basis IDs/);

  assert.throws(() => validateGeneratedQuestions({
    questions: [draft({ approved: true })],
    targetCount: 1,
    validBasisIds
  }), /draft-only governance/);

  assert.doesNotThrow(() => validateGeneratedQuestions({
    questions: [draft()],
    targetCount: 1,
    validBasisIds
  }));
});
