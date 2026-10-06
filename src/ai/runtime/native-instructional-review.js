'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const INSTRUCTIONAL_REVIEW_CHECKLIST_VERSION = 'native-instructional-review-v1';
const ELIGIBLE_INSTRUCTIONAL_REVIEWER_ROLES = new Set(['instructional_reviewer']);
const DECISIONS = new Set(['pass', 'revise', 'reject']);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function stableInstructionalReviewEvidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function buildInstructionalReviewEvidence({
  provenanceId,
  questionId,
  payloadSha256,
  citationSetHash,
  citationValidationEvidenceHash,
  reviewerId,
  reviewerRole,
  technicalReviewerId,
  reviewedAt,
  decision,
  checklistCompleted,
  submittedBy,
  comments = '',
}) {
  requireCondition(UUID.test(provenanceId || ''), 'A valid provenanceId is required.');
  requireCondition(typeof questionId === 'string' && questionId.length > 0, 'A questionId is required.');
  requireCondition(SHA256.test(payloadSha256 || ''), 'A valid payload SHA-256 is required.');
  requireCondition(SHA256.test(citationSetHash || ''), 'A valid citation-set SHA-256 is required.');
  requireCondition(SHA256.test(citationValidationEvidenceHash || ''), 'A valid citation-validation evidence SHA-256 is required.');
  requireCondition(UUID.test(reviewerId || ''), 'A valid reviewerId is required.');
  requireCondition(UUID.test(technicalReviewerId || ''), 'A valid technicalReviewerId is required.');
  requireCondition(reviewerId !== technicalReviewerId, 'Instructional reviewer must be independent from the technical reviewer.');
  requireCondition(ELIGIBLE_INSTRUCTIONAL_REVIEWER_ROLES.has(reviewerRole), 'Reviewer role is not eligible for instructional review.');
  requireCondition(typeof reviewedAt === 'string' && !Number.isNaN(Date.parse(reviewedAt)), 'A valid reviewedAt is required.');
  requireCondition(DECISIONS.has(decision), 'Instructional review decision must be pass, revise, or reject.');
  requireCondition(typeof checklistCompleted === 'boolean', 'Instructional review checklist completion attestation is required.');
  requireCondition(typeof submittedBy === 'string' && submittedBy.length > 0, 'Instructional review submission actor is required.');
  requireCondition(typeof comments === 'string' && comments.length <= 4000, 'Instructional review comments are invalid.');
  if (decision === 'pass') {
    requireCondition(checklistCompleted === true, 'A passing instructional review requires the checklist to be completed.');
  }

  const evidence = {
    provenanceId,
    questionId,
    payloadSha256,
    citationSetHash,
    citationValidationEvidenceHash,
    reviewerId,
    reviewerRole,
    technicalReviewerId,
    reviewedAt,
    decision,
    checklistVersion: INSTRUCTIONAL_REVIEW_CHECKLIST_VERSION,
    checklistCompleted,
    allCriteriaPassed: decision === 'pass',
    criteriaReviewed: [
      'learning-objective-alignment',
      'cognitive-demand-appropriate',
      'stem-clear-and-instructionally-sound',
      'distractors-plausible-without-cueing',
      'explanation-supports-learning-and-remediation',
      'language-accessible-and-free-of-unnecessary-bias',
    ],
    submittedBy,
    comments,
  };

  return {
    evidence,
    evidenceHash: stableInstructionalReviewEvidenceHash(evidence),
  };
}

function assertInstructionalReviewContainment({
  scenarioQuestionCount,
  assessmentEligibilityCount,
  citationValidation,
  provenance,
}) {
  requireCondition(scenarioQuestionCount === 0, 'Instructional review must not create public scenario_questions rows.');
  requireCondition(assessmentEligibilityCount === 0, 'Instructional review must not create assessment eligibility.');
  requireCondition(citationValidation?.result === 'valid', 'Instructional review requires a valid citation validation.');
  requireCondition(citationValidation?.source_hashes_verified === true, 'Instructional review requires source-hash validation.');
  requireCondition(citationValidation?.excerpts_verified === true, 'Instructional review requires excerpt validation.');
  requireCondition(citationValidation?.urls_verified === true, 'Instructional review requires URL validation.');
  requireCondition(provenance?.status === 'draft', 'Provenance must remain draft during instructional review.');
  requireCondition(
    provenance.technical_reviewer_id && provenance.technical_reviewed_at,
    'Instructional review requires completed technical review.'
  );
  requireCondition(
    !provenance.approved_by && !provenance.approved_at,
    'Instructional review must not synthesize content approval.'
  );
}

module.exports = {
  INSTRUCTIONAL_REVIEW_CHECKLIST_VERSION,
  ELIGIBLE_INSTRUCTIONAL_REVIEWER_ROLES,
  stableInstructionalReviewEvidenceHash,
  buildInstructionalReviewEvidence,
  assertInstructionalReviewContainment,
};
