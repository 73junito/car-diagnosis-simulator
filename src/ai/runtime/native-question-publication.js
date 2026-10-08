'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const UNRESOLVED_GOVERNANCE_SENTINEL = 'UNRESOLVED_GOVERNANCE_DECISION';
const NATIVE_PUBLICATION_ACTIVE_STATUS = 'governance-resolved-activation-ready';
const PUBLICATION_DECISIONS = new Set(['approve', 'reject']);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isUnresolved(value) {
  return typeof value !== 'string' || value.trim().length === 0 || value.includes(UNRESOLVED_GOVERNANCE_SENTINEL);
}

function collectUnresolvedPublicationGovernance(contract) {
  requireCondition(contract && typeof contract === 'object', 'A native publication contract is required.');
  const constants = contract.governance_constants || {};
  const independence = constants.independencePolicy || {};
  const unresolved = [];
  if (isUnresolved(constants.PUBLICATION_APPROVER_REQUIRED_ROLE)) unresolved.push('PUBLICATION_APPROVER_REQUIRED_ROLE');
  if (isUnresolved(constants.PUBLICATION_APPROVER_REQUIRED_SCOPE)) unresolved.push('PUBLICATION_APPROVER_REQUIRED_SCOPE');
  if (typeof independence.independentFromFinalContentApprover !== 'boolean') {
    unresolved.push('independencePolicy.independentFromFinalContentApprover');
  }
  if (isUnresolved(constants.checklistVersion)) unresolved.push('checklistVersion');
  if (!Array.isArray(constants.checklistCriteria) || constants.checklistCriteria.length === 0 ||
      constants.checklistCriteria.some(isUnresolved)) unresolved.push('checklistCriteria');
  if (isUnresolved(constants.publicationTarget)) unresolved.push('publicationTarget');
  return unresolved;
}

function assertNativePublicationActivationGate(contract) {
  const unresolved = collectUnresolvedPublicationGovernance(contract);
  requireCondition(unresolved.length === 0, 'Native publication fails closed; unresolved governance decisions: ' + unresolved.join(', '));
  requireCondition(contract.status === NATIVE_PUBLICATION_ACTIVE_STATUS, 'Native publication contract is not activation-ready.');
  requireCondition(contract.governance_constants.publicationTarget === 'scenario_questions', 'Native publication target is not approved.');
}

function assertPublicationIndependence({ contract, publicationApproverId, finalApproverId } = {}) {
  requireCondition(UUID.test(publicationApproverId || ''), 'A valid publication approver UUID is required.');
  requireCondition(UUID.test(finalApproverId || ''), 'A valid final approver UUID is required.');
  if (contract.governance_constants.independencePolicy.independentFromFinalContentApprover) {
    requireCondition(publicationApproverId !== finalApproverId, 'Publication approver must be independent from the final content approver.');
  }
}

function stablePublicationEvidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function buildPublicationEvidence({
  provenanceId,
  questionId,
  scenarioId,
  payloadSha256,
  finalApprovalEvidenceHash,
  reviewerId,
  approverRole,
  approverScope,
  finalApproverId,
  reviewedAt,
  decision,
  checklistCompleted,
  submittedBy,
  contract,
} = {}) {
  assertNativePublicationActivationGate(contract);
  requireCondition(UUID.test(provenanceId || ''), 'A valid provenanceId is required.');
  requireCondition(typeof questionId === 'string' && questionId.length > 0, 'A questionId is required.');
  requireCondition(typeof scenarioId === 'string' && scenarioId.length > 0, 'A scenarioId is required.');
  requireCondition(SHA256.test(payloadSha256 || ''), 'A valid payload SHA-256 is required.');
  requireCondition(SHA256.test(finalApprovalEvidenceHash || ''), 'A valid final-approval evidence SHA-256 is required.');
  requireCondition(UUID.test(reviewerId || ''), 'A valid publication approver UUID is required.');
  requireCondition(PUBLICATION_DECISIONS.has(decision), 'Publication decision must be approve or reject.');
  requireCondition(checklistCompleted === true, 'The human publication checklist must be completed.');
  requireCondition(typeof reviewedAt === 'string' && !Number.isNaN(Date.parse(reviewedAt)), 'A valid publication timestamp is required.');
  requireCondition(typeof submittedBy === 'string' && submittedBy.length > 0, 'Publication submission actor is required.');

  assertPublicationIndependence({ contract, publicationApproverId: reviewerId, finalApproverId });
  requireCondition(approverRole === contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_ROLE, 'Publication approver role does not match the approved role.');
  requireCondition(approverScope === contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_SCOPE, 'Publication approver scope does not match the approved scope.');

  const evidence = {
    provenanceId,
    questionId,
    scenarioId,
    payloadSha256,
    finalApprovalEvidenceHash,
    reviewerId,
    approverRole,
    approverScope,
    finalApproverId,
    reviewedAt,
    decision,
    publicationTarget: contract.governance_constants.publicationTarget,
    checklistVersion: contract.governance_constants.checklistVersion,
    checklistCompleted,
    checklistCriteria: [...contract.governance_constants.checklistCriteria],
    allCriteriaPassed: decision === 'approve',
    submittedBy,
  };
  return { evidence, evidenceHash: stablePublicationEvidenceHash(evidence) };
}

function assertPhase10HEvidenceBinding({ contract, provenance, latestEntry, questionId, payloadSha256 } = {}) {
  const expected = contract.referenced_10H_evidence;
  requireCondition(provenance?.id === expected.provenance_id, 'Publication provenance does not match Phase 10H.');
  requireCondition(provenance?.question_id === questionId && questionId === expected.question_id, 'Publication question identity does not match Phase 10H.');
  requireCondition(provenance?.status === 'approved', 'Publication requires approved provenance.');
  requireCondition(provenance?.approved_by === expected.final_approver_id, 'Publication final approver binding does not match Phase 10H.');
  requireCondition(provenance?.validation_checklist?.final_approval_evidence_hash === expected.final_approval_evidence_hash, 'Publication final-approval evidence hash does not match Phase 10H.');
  requireCondition(payloadSha256 === expected.payload_sha256, 'Publication payload hash does not match Phase 10H.');
  requireCondition(latestEntry?.version === 7, 'Publication requires governed ledger version 7.');
  requireCondition(latestEntry?.action === 'final-content-approval-recorded' && latestEntry?.state === 'final_content_approved', 'Publication requires the final_content_approved governed checkpoint.');
  requireCondition(latestEntry?.metadata?.approvalEvidenceHash === expected.final_approval_evidence_hash, 'Governed final-approval evidence hash does not match Phase 10H.');
}

function buildScenarioQuestionRow(question) {
  requireCondition(question && typeof question === 'object', 'Validated native question is required.');
  return {
    scenario_id: question.scenario_slug,
    question_id: question.question_id,
    question_text: question.question,
    option_a: question.options.A,
    option_b: question.options.B,
    option_c: question.options.C,
    option_d: question.options.D,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    difficulty: question.difficulty || null,
    topic: question.topic || null,
    ase_area: question.ase_area || null,
  };
}

function assertExactPublishedRow(actual, expected) {
  const keys = ['scenario_id','question_id','question_text','option_a','option_b','option_c','option_d','correct_answer','explanation','difficulty','topic','ase_area'];
  for (const key of keys) {
    requireCondition((actual?.[key] ?? null) === (expected?.[key] ?? null), 'Published scenario question mismatch: ' + key);
  }
}

function assertPublicationContainment({ publicRows, assessmentEligibilityCount, expectedRow } = {}) {
  requireCondition(Array.isArray(publicRows) && publicRows.length === 1, 'Publication must create exactly one public scenario_questions row.');
  assertExactPublishedRow(publicRows[0], expectedRow);
  requireCondition(assessmentEligibilityCount === 0, 'Publication must not create assessment eligibility.');
}

module.exports = {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  NATIVE_PUBLICATION_ACTIVE_STATUS,
  PUBLICATION_DECISIONS,
  collectUnresolvedPublicationGovernance,
  assertNativePublicationActivationGate,
  assertPublicationIndependence,
  stablePublicationEvidenceHash,
  buildPublicationEvidence,
  assertPhase10HEvidenceBinding,
  buildScenarioQuestionRow,
  assertExactPublishedRow,
  assertPublicationContainment,
};
