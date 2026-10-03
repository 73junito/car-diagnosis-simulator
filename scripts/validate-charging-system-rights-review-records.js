'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const RECORDS_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-rights-review-records-20261003.json');
const MANIFEST_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-challenge-candidate-source-manifest-20261003.json');
const INTAKE_PATH = path.join(repoRoot, 'evidence', 'review-queues',
  'scenario-challenge-evidence-intake-20261003.json');

const ZERO_KEYS = [
  'mapped_count', 'citation_validated_count', 'technical_reviewed_count',
  'instructional_reviewed_count', 'approved_count', 'assessment_eligible_count'
];

// Rights review must never smuggle claim-to-source mapping into this artifact.
const FORBIDDEN_REVIEW_KEY = /claim|question_id|draft_id|mapping/i;

// Clearance is scope-specific: a narrower cleared value never implies a broader one.
const PERMITTED_RIGHTS_CLASSIFICATIONS = [
  'pending',
  'cleared-link-citation-only',
  'cleared-metadata-only',
  'cleared-text-excerpt',
  'cleared-full-text-storage',
  'cleared-rag-use',
  'cleared-commercial-reuse',
  'restricted',
  'rejected'
];

function readJson(filePath, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} could not be read from ${filePath}: ${error.message}`);
    return null;
  }
}

function nonEmptyRecordText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRightsReviewRecords(options = {}) {
  const recordsPath = options.recordsPath || RECORDS_PATH;
  const manifestPath = options.manifestPath || MANIFEST_PATH;
  const intakePath = options.intakePath || INTAKE_PATH;
  const errors = [];

  const records = readJson(recordsPath, errors, 'rights-review records');
  const manifest = readJson(manifestPath, errors, 'candidate-source manifest');
  const intake = readJson(intakePath, errors, 'intake queue');
  if (errors.length > 0) return { errors, summary: null };

  if (records.artifact_type !== 'human-rights-review-record') {
    errors.push(`artifact_type must be human-rights-review-record; received ${records.artifact_type}`);
  }
  if (records.scenario_id !== 'charging-system') {
    errors.push(`scenario_id must be charging-system; received ${records.scenario_id}`);
  }
  if (records.stage !== 'awaiting-human-rights-review') {
    errors.push(`stage must be awaiting-human-rights-review; received ${records.stage}`);
  }
  if (records.policy !== 'data/evidence/open-evidence-source-policy.json') {
    errors.push('records must reference data/evidence/open-evidence-source-policy.json as their policy');
  }

  const reviews = Array.isArray(records.reviews) ? records.reviews : null;
  if (!reviews || reviews.length === 0) {
    errors.push('reviews must be a non-empty array');
    return { errors, summary: null };
  }

  if (JSON.stringify(records.permitted_rights_classifications) !==
      JSON.stringify(PERMITTED_RIGHTS_CLASSIFICATIONS)) {
    errors.push('permitted_rights_classifications must match the scope-specific clearance vocabulary');
  }
  if (!nonEmptyRecordText(records.rights_classification_note)) {
    errors.push('rights_classification_note must be recorded');
  }

  const seen = new Set();
  for (const review of reviews) {
    const label = review.candidate_id || '<review missing candidate_id>';
    if (!review.candidate_id) errors.push('every review row must record a candidate_id');
    else if (seen.has(review.candidate_id)) errors.push(`${label}: duplicate review row`);
    else seen.add(review.candidate_id);

    for (const key of Object.keys(review)) {
      if (FORBIDDEN_REVIEW_KEY.test(key)) {
        errors.push(`${label}: rights-review rows must not contain mapping field ${key}`);
      }
    }
    if (review.store_verbatim_excerpt !== false) errors.push(`${label}: store_verbatim_excerpt must be false`);
    if (review.may_generate_questions !== false) errors.push(`${label}: may_generate_questions must be false`);
    if (review.approval_effect !== 'none') errors.push(`${label}: approval_effect must be none`);

    if (review.rights_decision === 'pending') {
      for (const field of ['decided_rights_classification', 'reviewer_identity', 'reviewed_at',
        'artifact_sha256', 'scope_of_clearance', 'review_notes']) {
        if (review[field] !== null) {
          errors.push(`${label}: ${field} must stay null until a named human reviewer records a decision`);
        }
      }
    } else if (!PERMITTED_RIGHTS_CLASSIFICATIONS.includes(review.rights_decision)) {
      errors.push(`${label}: rights_decision '${review.rights_decision}' is not an accepted state; introduce decided states together with an explicit validator contract`);
    }
  }

  const manifestIds = new Set((manifest.source_candidates || []).map((source) => source.candidate_id));
  for (const id of seen) {
    if (!manifestIds.has(id)) errors.push(`${id}: not present in the discovery manifest source_candidates`);
  }
  for (const id of manifestIds) {
    if (!seen.has(id)) errors.push(`${id}: discovery manifest candidate has no rights-review row`);
  }

  const summary = records.summary || {};
  if (summary.sources_in_review !== reviews.length) {
    errors.push(`summary.sources_in_review must equal ${reviews.length}`);
  }
  if (summary.rights_decisions_recorded !== 0) errors.push('summary.rights_decisions_recorded must be 0');
  if (summary.sources_cleared !== 0) errors.push('summary.sources_cleared must be 0');
  if (summary.sources_candidate_only !== reviews.length) {
    errors.push(`summary.sources_candidate_only must equal ${reviews.length}`);
  }
  for (const key of ZERO_KEYS) {
    if (summary[key] !== 0) errors.push(`summary.${key} must be 0`);
  }

  if (!intake.summary || intake.summary.mapped_count !== 0) {
    errors.push('intake queue summary.mapped_count must remain 0');
  }
  for (const entry of (intake.entries || []).filter((row) => row.scenario_id === 'charging-system')) {
    if (entry.mapping_status !== 'unmapped-source-discovery-required') {
      errors.push(`${entry.synthetic_draft_id}: intake mapping_status must remain unmapped-source-discovery-required`);
    }
  }

  return { errors, summary };
}

function formatSummary(summary) {
  return [
    `sources_in_review: ${summary.sources_in_review}`,
    `rights_decisions_recorded: ${summary.rights_decisions_recorded}`,
    `sources_cleared: ${summary.sources_cleared}`,
    `sources_candidate_only: ${summary.sources_candidate_only}`,
    `mapped_count: ${summary.mapped_count}`,
    `citation_validated_count: ${summary.citation_validated_count}`,
    `technical_reviewed_count: ${summary.technical_reviewed_count}`,
    `instructional_reviewed_count: ${summary.instructional_reviewed_count}`,
    `approved_count: ${summary.approved_count}`,
    `assessment_eligible_count: ${summary.assessment_eligible_count}`
  ].join('\n');
}

if (require.main === module) {
  const { errors, summary } = validateRightsReviewRecords();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(formatSummary(summary));
    console.log('PASS: charging-system rights-review records validate as fail-closed and decision-free.');
  }
}

module.exports = {
  validateRightsReviewRecords,
  formatSummary,
  RECORDS_PATH,
  MANIFEST_PATH,
  INTAKE_PATH
};