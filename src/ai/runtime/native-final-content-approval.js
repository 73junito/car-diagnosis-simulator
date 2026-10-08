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
  if (independence.independentFromTechnicalReviewer !== true) {
    unresolved.push('independencePolicy.independentFromTechnicalReviewer');
  }
  if (independence.independentFromInstructionalReviewer !== true) {
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
  assertFinalContentApprovalContainment,
};