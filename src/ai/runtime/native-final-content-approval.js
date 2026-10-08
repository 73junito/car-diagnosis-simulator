'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const UNRESOLVED_GOVERNANCE_SENTINEL = 'UNRESOLVED_GOVERNANCE_DECISION';
const FINAL_CONTENT_APPROVAL_ACTIVE_STATUS = 'governance-resolved-activation-ready';
const FINAL_APPROVAL_DECISIONS = new Set(['approve', 'reject']);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isUnresolvedGovernanceString(value) {
  return (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.includes(UNRESOLVED_GOVERNANCE_SENTINEL)
  );
}

function collectUnresolvedGovernanceDecisions(contract) {
  requireCondition(
    contract && typeof contract === 'object',
    'A native final content approval contract is required.'
  );
  const constants = contract.governance_constants || {};
  const independence = constants.independencePolicy || {};
  const unresolved = [];

  if (isUnresolvedGovernanceString(constants.FINAL_APPROVER_REQUIRED_ROLE)) {
    unresolved.push('FINAL_APPROVER_REQUIRED_ROLE');
  }
  if (isUnresolvedGovernanceString(constants.FINAL_APPROVER_REQUIRED_SCOPE)) {
    unresolved.push('FINAL_APPROVER_REQUIRED_SCOPE');
  }
  if (typeof independence.independentFromTechnicalReviewer !== 'boolean') {
    unresolved.push('independencePolicy.independentFromTechnicalReviewer');
  }
  if (typeof independence.independentFromInstructionalReviewer !== 'boolean') {
    unresolved.push('independencePolicy.independentFromInstructionalReviewer');
  }
  if (isUnresolvedGovernanceString(constants.checklistVersion)) {
    unresolved.push('checklistVersion');
  }
  if (
    !Array.isArray(constants.checklistCriteria) ||
    constants.checklistCriteria.length === 0 ||
    constants.checklistCriteria.some((criterion) => isUnresolvedGovernanceString(criterion))
  ) {
    unresolved.push('checklistCriteria');
  }

  return unresolved;
}

function assertGovernanceConstantsResolved(contract) {
  const unresolved = collectUnresolvedGovernanceDecisions(contract);
  requireCondition(
    unresolved.length === 0,
    'Final content approval fails closed; unresolved governance decisions: ' + unresolved.join(', ')
  );
}

function assertFinalContentApprovalActivationGate(contract) {
  assertGovernanceConstantsResolved(contract);
  requireCondition(
    contract.status === FINAL_CONTENT_APPROVAL_ACTIVE_STATUS,
    'Final content approval contract is not activation-ready.'
  );
}

function assertApprovedIndependencePolicy({
  independencePolicy,
  approverId,
  technicalReviewerId,
  instructionalReviewerId,
} = {}) {
  requireCondition(
    independencePolicy &&
      typeof independencePolicy.independentFromTechnicalReviewer === 'boolean' &&
      typeof independencePolicy.independentFromInstructionalReviewer === 'boolean',
    'The independence policy must be an approved boolean decision.'
  );
  if (independencePolicy.independentFromTechnicalReviewer) {
    requireCondition(
      approverId !== technicalReviewerId,
      'Final content approver must be independent from the technical reviewer under the approved policy.'
    );
  }
  if (independencePolicy.independentFromInstructionalReviewer) {
    requireCondition(
      approverId !== instructionalReviewerId,
      'Final content approver must be independent from the instructional reviewer under the approved policy.'
    );
  }
}

function stableFinalContentApprovalEvidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function assertFinalContentApprovalEvidenceContract(approvalEvidence, contract) {
  const constants = contract && contract.governance_constants;
  requireCondition(constants, 'Final content approval governance constants are required.');
  requireCondition(
    approvalEvidence && typeof approvalEvidence === 'object',
    'Final content approval evidence is required.'
  );
  requireCondition(
    approvalEvidence.approverRole === constants.FINAL_APPROVER_REQUIRED_ROLE,
    'Final content approval approver role does not match the approved FINAL_APPROVER_REQUIRED_ROLE.'
  );
  requireCondition(
    approvalEvidence.approverScope === constants.FINAL_APPROVER_REQUIRED_SCOPE,
    'Final content approval approver scope does not match the approved FINAL_APPROVER_REQUIRED_SCOPE.'
  );
  requireCondition(
    approvalEvidence.checklistCompleted === true,
    'The human final approval checklist must be completed.'
  );
  requireCondition(
    approvalEvidence.checklistVersion === constants.checklistVersion,
    'Final content approval checklist version does not match the approved checklist version.'
  );
  requireCondition(
    Array.isArray(approvalEvidence.checklistCriteria) &&
      approvalEvidence.checklistCriteria.length === constants.checklistCriteria.length &&
      approvalEvidence.checklistCriteria.every(
        (criterion, index) => criterion === constants.checklistCriteria[index]
      ),
    'Final content approval evidence does not carry the complete approved checklist criteria.'
  );
  requireCondition(
    SHA256.test(approvalEvidence.instructionalReviewEvidenceHash || ''),
    'Final content approval evidence must carry the exact 64-hex Phase 10G instructional review evidence hash.'
  );
}

function buildFinalContentApprovalEvidence({
  provenanceId,
  questionId,
  payloadSha256,
  citationSetHash,
  citationValidationEvidenceHash,
  instructionalReviewEvidenceHash,
  reviewerId,
  approverRole,
  approverScope,
  technicalReviewerId,
  instructionalReviewerId,
  reviewedAt,
  decision,
  checklistCompleted,
  submittedBy,
  contract,
}) {
  assertFinalContentApprovalActivationGate(contract);
  requireCondition(UUID.test(provenanceId || ''), 'A valid provenanceId is required.');
  requireCondition(typeof questionId === 'string' && questionId.length > 0, 'A questionId is required.');
  requireCondition(SHA256.test(payloadSha256 || ''), 'A valid payload SHA-256 is required.');
  requireCondition(SHA256.test(citationSetHash || ''), 'A valid citation-set SHA-256 is required.');
  requireCondition(SHA256.test(citationValidationEvidenceHash || ''), 'A valid citation-validation evidence SHA-256 is required.');
  requireCondition(SHA256.test(instructionalReviewEvidenceHash || ''), 'A valid instructional-review evidence SHA-256 is required.');
  requireCondition(UUID.test(reviewerId || ''), 'A valid final approver UUID is required.');
  requireCondition(UUID.test(technicalReviewerId || ''), 'A valid technical reviewer UUID is required.');
  requireCondition(UUID.test(instructionalReviewerId || ''), 'A valid instructional reviewer UUID is required.');
  requireCondition(typeof reviewedAt === 'string' && !Number.isNaN(Date.parse(reviewedAt)), 'A valid final approval timestamp is required.');
  requireCondition(FINAL_APPROVAL_DECISIONS.has(decision), 'Final approval decision must be approve or reject.');
  requireCondition(checklistCompleted === true, 'The human final approval checklist must be completed.');
  requireCondition(typeof submittedBy === 'string' && submittedBy.length > 0, 'Final approval submission actor is required.');

  assertApprovedIndependencePolicy({
    independencePolicy: contract.governance_constants.independencePolicy,
    approverId: reviewerId,
    technicalReviewerId,
    instructionalReviewerId,
  });

  const evidence = {
    provenanceId,
    questionId,
    payloadSha256,
    citationSetHash,
    citationValidationEvidenceHash,
    instructionalReviewEvidenceHash,
    reviewerId,
    approverRole,
    approverScope,
    technicalReviewerId,
    instructionalReviewerId,
    reviewedAt,
    decision,
    checklistVersion: contract.governance_constants.checklistVersion,
    checklistCompleted,
    checklistCriteria: [...contract.governance_constants.checklistCriteria],
    allCriteriaPassed: decision === 'approve',
    submittedBy,
  };

  assertFinalContentApprovalEvidenceContract(evidence, contract);
  return {
    evidence,
    evidenceHash: stableFinalContentApprovalEvidenceHash(evidence),
  };
}

function assertInstructionalReviewEvidenceBinding({
  provenanceId,
  questionId,
  approvalEvidence,
  latestEntry,
} = {}) {
  requireCondition(
    latestEntry &&
      latestEntry.action === 'instructional-review-recorded' &&
      latestEntry.state === 'instructionally_reviewed',
    'Final content approval requires the instructionally_reviewed state.'
  );
  const metadata = latestEntry.metadata || {};
  requireCondition(
    metadata.provenanceId === provenanceId &&
      metadata.questionId === questionId &&
      metadata.payloadSha256 === approvalEvidence.payloadSha256 &&
      metadata.citationSetHash === approvalEvidence.citationSetHash &&
      metadata.citationValidationEvidenceHash === approvalEvidence.citationValidationEvidenceHash,
    'Final content approval evidence is not bound to the current instructional review.'
  );
  requireCondition(
    SHA256.test(metadata.reviewEvidenceHash || ''),
    'The instructional review record must carry the Phase 10G review evidence hash.'
  );
  requireCondition(
    approvalEvidence.instructionalReviewEvidenceHash === metadata.reviewEvidenceHash,
    'Final content approval instructionalReviewEvidenceHash does not match the Phase 10G instructional review evidence.'
  );
}

function assertFinalContentApprovalContainment({
  scenarioQuestionCount,
  assessmentEligibilityCount,
  provenance,
  reviewerId,
} = {}) {
  requireCondition(
    scenarioQuestionCount === 0,
    'Final content approval must not create public scenario_questions rows.'
  );
  requireCondition(
    assessmentEligibilityCount === 0,
    'Final content approval must not create assessment eligibility.'
  );
  requireCondition(provenance?.status === 'approved', 'Final content approval must leave provenance approved.');
  requireCondition(provenance?.approved_by === reviewerId, 'Final approver identity was not persisted exactly.');
  requireCondition(Boolean(provenance?.approved_at), 'Final approval timestamp was not persisted.');
}

module.exports = {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  FINAL_CONTENT_APPROVAL_ACTIVE_STATUS,
  FINAL_APPROVAL_DECISIONS,
  collectUnresolvedGovernanceDecisions,
  assertGovernanceConstantsResolved,
  assertFinalContentApprovalActivationGate,
  assertApprovedIndependencePolicy,
  stableFinalContentApprovalEvidenceHash,
  assertFinalContentApprovalEvidenceContract,
  buildFinalContentApprovalEvidence,
  assertInstructionalReviewEvidenceBinding,
  assertFinalContentApprovalContainment,
};
