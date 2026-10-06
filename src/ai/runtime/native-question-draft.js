'use strict';

const crypto = require('crypto');

const QUESTION_ID = /^[a-z0-9-]+$/;
const RUN_ID = /^[A-Za-z0-9._:-]+$/;
const SHA40 = /^[0-9a-f]{40}$/;

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

function buildPrivateDraftRow(document, question, {
  governedRunId,
  workflowRunId,
  workflowRunAttempt,
  sourceCommit,
  payloadText,
} = {}) {
  requireCondition(RUN_ID.test(governedRunId || ''), 'A valid governedRunId is required.');
  requireCondition(Number.isInteger(workflowRunId) && workflowRunId > 0, 'A valid workflowRunId is required.');
  requireCondition(Number.isInteger(workflowRunAttempt) && workflowRunAttempt > 0, 'A valid workflowRunAttempt is required.');
  requireCondition(SHA40.test(sourceCommit || ''), 'A valid sourceCommit is required.');
  requireCondition(typeof payloadText === 'string' && payloadText.length > 0, 'Exact payloadText is required.');

  const payloadSha256 = crypto.createHash('sha256').update(payloadText).digest('hex');

  return {
    governed_run_id: governedRunId,
    question_id: question.question_id,
    scenario_id: question.scenario_slug,
    workflow_run_id: workflowRunId,
    workflow_run_attempt: workflowRunAttempt,
    source_commit: sourceCommit,
    provider: document?.generator?.provider || 'ollama-cloud',
    model: document?.generator?.model || 'unknown',
    agent_version: document?.generator?.agent_version || 'unknown',
    payload_sha256: payloadSha256,
    status: 'drafted-unreviewed',
    payload_text: payloadText,
  };
}

function buildDraftProvenanceRow(questionId, { privateDraftId, payloadSha256, agentVersion } = {}) {
  requireCondition(QUESTION_ID.test(questionId || ''), 'Question provenance semantic ID is invalid.');
  requireCondition(typeof privateDraftId === 'string' && privateDraftId.length > 0, 'privateDraftId is required.');
  requireCondition(/^[0-9a-f]{64}$/.test(payloadSha256 || ''), 'payloadSha256 is invalid.');

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
    notes: [
      'Native governed draft payload is stored in the service-role-only private draft store.',
      'Evidence mapping, validation, independent human review, and explicit approval remain required.',
      `private_draft_id=${privateDraftId}`,
      `agent_version=${agentVersion || 'unknown'}`,
      `payload_sha256=${payloadSha256}`,
    ].join(' '),
  };
}

function assertExactExistingPrivateDraft(existing, expected) {
  const keys = [
    'governed_run_id',
    'question_id',
    'scenario_id',
    'source_commit',
    'provider',
    'model',
    'agent_version',
    'payload_sha256',
    'status',
    'payload_text',
  ];
  for (const key of keys) {
    const actual = existing?.[key] ?? null;
    const wanted = expected?.[key] ?? null;
    requireCondition(actual === wanted, `Existing private draft mismatch: ${key}`);
  }
}

function assertDraftProvenance(provenance, questionId, { privateDraftId, payloadSha256 } = {}) {
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
  if (privateDraftId) {
    requireCondition(
      String(provenance.notes || '').includes(`private_draft_id=${privateDraftId}`),
      'Draft provenance is not bound to the expected private draft.'
    );
  }
  if (payloadSha256) {
    requireCondition(
      String(provenance.notes || '').includes(`payload_sha256=${payloadSha256}`),
      'Draft provenance payload hash mismatch.'
    );
  }
}

module.exports = {
  validateNativeDraftArtifact,
  buildPrivateDraftRow,
  buildDraftProvenanceRow,
  assertExactExistingPrivateDraft,
  assertDraftProvenance,
};
