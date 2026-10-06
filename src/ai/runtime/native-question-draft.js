'use strict';

const QUESTION_ID = /^[a-z0-9-]+$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateNativeDraftArtifact(document, { scenarioId } = {}) {
  requireCondition(document && typeof document === 'object', 'Draft artifact is missing.');
  requireCondition(QUESTION_ID.test(scenarioId || ''), 'A valid scenarioId is required.');
  requireCondition(document?.generator?.scenario_id === scenarioId, 'Draft artifact scenario mismatch.');
  requireCondition(document?.governance?.auto_approval === false, 'Draft artifact auto-approval boundary failed.');
  requireCondition(document?.governance?.evidence_only === true, 'Draft artifact is not evidence-only.');
  requireCondition(
    document?.governance?.rights_verified_sources_only === true,
    'Draft artifact does not require rights-verified sources.'
  );
  requireCondition(
    document?.governance?.requires_human_technical_review === true,
    'Draft artifact does not require human technical review.'
  );
  requireCondition(
    document?.governance?.requires_human_instructional_review === true,
    'Draft artifact does not require human instructional review.'
  );
  requireCondition(Array.isArray(document.questions), 'Draft artifact questions are missing.');
  requireCondition(document.questions.length === 1, 'Native draft creation requires exactly one generated question.');

  const question = document.questions[0];
  requireCondition(QUESTION_ID.test(question?.question_id || ''), 'Generated question has an invalid semantic ID.');
  requireCondition(question.scenario_slug === scenarioId, 'Generated question scenario mismatch.');
  requireCondition(question.status === 'draft', 'Generated question is not draft.');
  requireCondition(question.approved === false, 'Generated question is already approved.');
  requireCondition(
    question.human_technical_review_completed === false,
    'Generated question already claims technical review.'
  );
  requireCondition(
    question.human_instructional_review_completed === false,
    'Generated question already claims instructional review.'
  );
  requireCondition(typeof question.question === 'string' && question.question.trim().length >= 15, 'Generated question stem is invalid.');
  requireCondition(['A', 'B', 'C', 'D'].includes(question.correct_answer), 'Generated question answer key is invalid.');
  requireCondition(question.options && typeof question.options === 'object', 'Generated question options are missing.');
  for (const key of ['A', 'B', 'C', 'D']) {
    requireCondition(typeof question.options[key] === 'string' && question.options[key].trim(), `Generated question option ${key} is invalid.`);
  }
  requireCondition(typeof question.explanation === 'string' && question.explanation.trim(), 'Generated question explanation is missing.');

  const citations = Array.isArray(question.citations) ? question.citations : [];
  const roles = new Set(citations.map((citation) => citation?.role));
  requireCondition(roles.has('supports-answer'), 'Generated question is missing supports-answer evidence.');
  requireCondition(roles.has('supports-explanation'), 'Generated question is missing supports-explanation evidence.');

  const artifactEvidence = new Set(
    (document.evidence || []).map((item) => `${item.source_id}::${item.chunk_id}`)
  );
  requireCondition(artifactEvidence.size > 0, 'Draft artifact evidence metadata is missing.');
  for (const citation of citations) {
    requireCondition(
      artifactEvidence.has(`${citation.source_id}::${citation.chunk_id}`),
      'Generated question cites evidence outside the artifact evidence set.'
    );
  }

  return question;
}

function buildScenarioQuestionRow(question) {
  return {
    scenario_id: question.scenario_slug,
    question_id: question.question_id,
    question_text: question.question.trim(),
    option_a: question.options.A.trim(),
    option_b: question.options.B.trim(),
    option_c: question.options.C.trim(),
    option_d: question.options.D.trim(),
    correct_answer: question.correct_answer,
    explanation: question.explanation.trim(),
    difficulty: question.difficulty || 'introductory',
  };
}

function buildDraftProvenanceRow(questionId) {
  return {
    question_id: questionId,
    provenance_version: 1,
    status: 'draft',
    validation_checklist: {
      sources_linked: false,
      citations_validated: false,
      technical_review_complete: false,
      instructional_review_complete: false,
    },
    notes: 'Native governed draft. Evidence mapping, validation, independent human review, and explicit approval remain required.',
  };
}

function assertExactExistingQuestion(existing, expected) {
  const keys = [
    'scenario_id',
    'question_id',
    'question_text',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'correct_answer',
    'explanation',
    'difficulty',
  ];
  for (const key of keys) {
    const actual = existing?.[key] ?? null;
    const wanted = expected?.[key] ?? null;
    requireCondition(actual === wanted, `Existing question mismatch: ${key}`);
  }
}

function assertDraftProvenance(provenance, questionId) {
  requireCondition(provenance?.question_id === questionId, 'Question provenance semantic ID mismatch.');
  requireCondition(provenance.status === 'draft', 'Question provenance is not draft.');
  requireCondition(
    !provenance.technical_reviewer_id &&
    !provenance.technical_reviewed_at &&
    !provenance.instructional_reviewer_id &&
    !provenance.instructional_reviewed_at &&
    !provenance.approved_by &&
    !provenance.approved_at,
    'Draft provenance already contains review or approval evidence.'
  );
}

module.exports = {
  validateNativeDraftArtifact,
  buildScenarioQuestionRow,
  buildDraftProvenanceRow,
  assertExactExistingQuestion,
  assertDraftProvenance,
};
