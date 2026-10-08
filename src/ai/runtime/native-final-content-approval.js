'use strict';

const UNRESOLVED_GOVERNANCE_SENTINEL = 'UNRESOLVED_GOVERNANCE_DECISION';

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
  if (unresolved.length > 0) {
    throw new Error(
      'Final content approval fails closed; unresolved governance decisions: ' +
        unresolved.join(', ')
    );
  }
}

function assertFinalContentApprovalScaffoldGate(contract) {
  assertGovernanceConstantsResolved(contract);
  requireCondition(
    contract.status !== 'draft-non-dispatchable',
    'Final content approval is disabled while the contract status is draft-non-dispatchable (Phase 10H non-production scaffold).'
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
  if (independencePolicy.independentFromTechnicalReviewer === true) {
    requireCondition(
      approverId !== technicalReviewerId,
      'Final content approver must be independent from the technical reviewer under the approved policy.'
    );
  }
  if (independencePolicy.independentFromInstructionalReviewer === true) {
    requireCondition(
      approverId !== instructionalReviewerId,
      'Final content approver must be independent from the instructional reviewer under the approved policy.'
    );
  }
}

function assertFinalContentApprovalEvidenceContract(approvalEvidence, contract) {
  const constants = contract && contract.governance_constants;
  requireCondition(
    approvalEvidence && typeof approvalEvidence === 'object',
    'Final content approval evidence is required.'
  );
  requireCondition(
    typeof approvalEvidence.approverRole === 'string' && approvalEvidence.approverRole.length > 0,
    'Final content approval evidence must carry the approver role.'
  );
  requireCondition(
    approvalEvidence.approverRole === constants.FINAL_APPROVER_REQUIRED_ROLE,
    'Final content approval approver role does not match the approved FINAL_APPROVER_REQUIRED_ROLE.'
  );
  requireCondition(
    typeof approvalEvidence.approverScope === 'string' && approvalEvidence.approverScope.length > 0,
    'Final content approval evidence must carry the approver scope.'
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
    Array.isArray(constants.checklistCriteria) && constants.checklistCriteria.length > 0,
    'Approved checklist criteria must be a non-empty list.'
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
    /^[0-9a-f]{64}$/.test(approvalEvidence.instructionalReviewEvidenceHash || ''),
    'Final content approval evidence must carry the exact 64-hex Phase 10G instructional review evidence hash.'
  );
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
    'Final content approval requires the instructionally_reviewed state'
  );
  const metadata = latestEntry.metadata || {};
  requireCondition(
    metadata.provenanceId === provenanceId &&
      metadata.questionId === questionId &&
      metadata.payloadSha256 === approvalEvidence.payloadSha256 &&
      metadata.citationSetHash === approvalEvidence.citationSetHash &&
      metadata.citationValidationEvidenceHash === approvalEvidence.citationValidationEvidenceHash,
    'Final content approval evidence is not bound to the current instructional review'
  );
  requireCondition(
    typeof metadata.reviewEvidenceHash === 'string' && metadata.reviewEvidenceHash.length > 0,
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
  releasedForAssessment,
  scoredDeliveryAuthority,
  provenance,
} = {}) {
  requireCondition(
    scenarioQuestionCount === 0,
    'Final content approval must not create public scenario_questions rows.'
  );
  requireCondition(
    assessmentEligibilityCount === 0,
    'Final content approval must not create assessment eligibility.'
  );
  requireCondition(
    releasedForAssessment === false,
    'Final content approval must not release content for assessment.'
  );
  requireCondition(
    scoredDeliveryAuthority === false,
    'Final content approval must not grant scored delivery authority.'
  );
  if (provenance) {
    requireCondition(
      !provenance.approved_by && !provenance.approved_at,
      'Phase 10H must not write final approval fields to question_provenance.'
    );
  }
}

module.exports = {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  collectUnresolvedGovernanceDecisions,
  assertGovernanceConstantsResolved,
  assertFinalContentApprovalScaffoldGate,
  assertApprovedIndependencePolicy,
  assertFinalContentApprovalEvidenceContract,
  assertInstructionalReviewEvidenceBinding,
  assertFinalContentApprovalContainment,
};