'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const TECHNICAL_REVIEW_CHECKLIST_VERSION = 'charging-system-technical-review-v1';
const ELIGIBLE_TECHNICAL_REVIEWER_ROLES = new Set(['developer_reviewer', 'technical_reviewer']);
const DECISIONS = new Set(['pass', 'revise', 'reject']);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function stableTechnicalReviewEvidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function buildTechnicalReviewEvidence({
  provenanceId,
  questionId,
  payloadSha256,
  reviewerId,
  reviewerRole,
  reviewedAt,
  decision,
  checklistCompleted,
  submittedBy,
  comments = '',
}) {
  requireCondition(UUID.test(provenanceId || ''), 'A valid provenanceId is required.');
  requireCondition(typeof questionId === 'string' && questionId.length > 0, 'A questionId is required.');
  requireCondition(SHA256.test(payloadSha256 || ''), 'A valid payload SHA-256 is required.');
  requireCondition(UUID.test(reviewerId || ''), 'A valid reviewerId is required.');
  requireCondition(ELIGIBLE_TECHNICAL_REVIEWER_ROLES.has(reviewerRole), 'Reviewer role is not eligible for technical review.');
  requireCondition(typeof reviewedAt === 'string' && !Number.isNaN(Date.parse(reviewedAt)), 'A valid reviewedAt is required.');
  requireCondition(DECISIONS.has(decision), 'Technical review decision must be pass, revise, or reject.');
  requireCondition(typeof checklistCompleted === 'boolean', 'Technical review checklist completion attestation is required.');
  requireCondition(typeof submittedBy === 'string' && submittedBy.length > 0, 'Technical review submission actor is required.');
  requireCondition(typeof comments === 'string' && comments.length <= 4000, 'Technical review comments are invalid.');
  if (decision === 'pass') {
    requireCondition(checklistCompleted === true, 'A passing technical review requires the checklist to be completed.');
  }

  const evidence = {
    provenanceId,
    questionId,
    payloadSha256,
    reviewerId,
    reviewerRole,
    reviewedAt,
    decision,
    checklistVersion: TECHNICAL_REVIEW_CHECKLIST_VERSION,
    checklistCompleted,
    allCriteriaPassed: decision === 'pass',
    criteriaReviewed: [
      'keyed-answer-correct-within-approved-evidence',
      'explanation-adds-no-unsupported-claims',
      'terminology-accurate-and-unambiguous',
      'distractors-do-not-create-second-defensible-answer',
      'not-materially-duplicative'
    ],
    submittedBy,
    comments,
  };

  return {
    evidence,
    evidenceHash: stableTechnicalReviewEvidenceHash(evidence),
  };
}

function assertTechnicalReviewContainment({
  scenarioQuestionCount,
  assessmentEligibilityCount,
  citationValidationCount,
  provenance,
}) {
  requireCondition(scenarioQuestionCount === 0, 'Technical review must not create public scenario_questions rows.');
  requireCondition(assessmentEligibilityCount === 0, 'Technical review must not create assessment eligibility.');
  requireCondition(citationValidationCount === 0, 'Technical review must not synthesize citation validation.');
  requireCondition(provenance?.status === 'draft', 'Provenance must remain draft during technical review.');
  requireCondition(
    !provenance.instructional_reviewer_id && !provenance.instructional_reviewed_at,
    'Technical review must not synthesize instructional review.'
  );
  requireCondition(
    !provenance.approved_by && !provenance.approved_at,
    'Technical review must not synthesize content approval.'
  );
}

module.exports = {
  TECHNICAL_REVIEW_CHECKLIST_VERSION,
  ELIGIBLE_TECHNICAL_REVIEWER_ROLES,
  stableTechnicalReviewEvidenceHash,
  buildTechnicalReviewEvidence,
  assertTechnicalReviewContainment,
};
