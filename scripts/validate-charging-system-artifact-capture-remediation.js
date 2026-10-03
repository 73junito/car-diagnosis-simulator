'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const REMEDIATION_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-artifact-capture-remediation-20261003.json');
const INVENTORY_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-artifact-capture-inventory-20261003.json');

const REMEDIATION_STATUSES = [
  'stable-artifact-of-record',
  'unstable-no-stable-export',
  'unavailable-access-blocked'
];
const STABLE_STATUS = 'stable-artifact-of-record';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// Machine-only remediation: no claim/draft/mapping/technical-review/approval/eligibility fields.
const FORBIDDEN_KEY = /claim|draft|question_id|mapping|technical|instructional|approv|eligib|rights_decision|reviewer_identity/i;

function readJson(filePath, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} could not be read from ${filePath}: ${error.message}`);
    return null;
  }
}

function walkKeys(value, visit, trail = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkKeys(item, visit, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      visit(key, trail);
      walkKeys(nested, visit, `${trail}.${key}`);
    }
  }
}

function validateRemediation(options = {}) {
  const errors = [];
  const remediation = readJson(options.remediationPath || REMEDIATION_PATH, errors, 'artifact-capture remediation');
  const inventory = readJson(options.inventoryPath || INVENTORY_PATH, errors, 'base artifact-capture inventory');
  if (errors.length > 0) return { errors, summary: null };

  if (remediation.artifact_type !== 'candidate-source-artifact-capture-remediation') {
    errors.push(`artifact_type must be candidate-source-artifact-capture-remediation; received ${remediation.artifact_type}`);
  }
  if (remediation.scenario_id !== 'charging-system') {
    errors.push(`scenario_id must be charging-system; received ${remediation.scenario_id}`);
  }
  if (remediation.stage !== 'capture-remediation-complete-pending-human-rights-review') {
    errors.push(`stage must be capture-remediation-complete-pending-human-rights-review; received ${remediation.stage}`);
  }

  walkKeys(remediation, (key, trail) => {
    if (FORBIDDEN_KEY.test(key)) errors.push(`${trail}: remediation must not contain field ${key}`);
  });

  const candidates = Array.isArray(remediation.candidates) ? remediation.candidates : null;
  if (!candidates || candidates.length === 0) {
    errors.push('candidates must be a non-empty array');
    return { errors, summary: null };
  }

  const inventoryIds = new Set((inventory.artifacts || []).map((row) => row.candidate_id));
  const seen = new Set();

  for (const row of candidates) {
    const label = row.candidate_id || '<remediation row missing candidate_id>';
    if (!row.candidate_id) errors.push('every remediation row must record a candidate_id');
    else if (seen.has(row.candidate_id)) errors.push(`${label}: duplicate remediation row`);
    else seen.add(row.candidate_id);
    if (row.candidate_id && !inventoryIds.has(row.candidate_id)) {
      errors.push(`${label}: not present in the base artifact-capture inventory`);
    }
    if (typeof row.objective !== 'string' || row.objective.trim() === '') {
      errors.push(`${label}: objective must be recorded`);
    }
    if (!Array.isArray(row.attempts) || row.attempts.length === 0) {
      errors.push(`${label}: at least one remediation attempt must be recorded`);
    }
    for (const attempt of row.attempts || []) {
      if (typeof attempt.method !== 'string' || attempt.method.trim() === '') {
        errors.push(`${label}: each attempt must record a method`);
      }
      if (attempt.url !== null && !/^https:\/\//.test(String(attempt.url))) {
        errors.push(`${label}: attempt url must be an https URL or null`);
      }
      if (attempt.http_status !== null && !Number.isInteger(attempt.http_status)) {
        errors.push(`${label}: attempt http_status must be an integer or null for non-HTTP attempts`);
      }
      if (!ISO_TIMESTAMP_PATTERN.test(String(attempt.retrieved_at))) {
        errors.push(`${label}: attempt retrieved_at must be an ISO-8601 UTC timestamp`);
      }
      if (typeof attempt.outcome !== 'string' || attempt.outcome.trim() === '') {
        errors.push(`${label}: each attempt must record an outcome`);
      }
    }

    const resolution = row.resolution || {};
    if (!REMEDIATION_STATUSES.includes(resolution.status)) {
      errors.push(`${label}: resolution status must be one of ${REMEDIATION_STATUSES.join(', ')}`);
    }
    for (const field of ['stability', 'note']) {
      if (typeof resolution[field] !== 'string' || resolution[field].trim() === '') {
        errors.push(`${label}: resolution ${field} must be recorded`);
      }
    }
    if (resolution.status === STABLE_STATUS) {
      if (!/^https:\/\//.test(String(resolution.artifact_of_record_url))) {
        errors.push(`${label}: stable rows must record an https artifact_of_record_url`);
      }
      if (!SHA256_PATTERN.test(String(resolution.artifact_of_record_sha256))) {
        errors.push(`${label}: stable rows must record a lowercase 64-character artifact_of_record_sha256`);
      }
      if (!Number.isInteger(resolution.artifact_of_record_byte_length) ||
          resolution.artifact_of_record_byte_length <= 0) {
        errors.push(`${label}: stable rows must record a positive artifact_of_record_byte_length`);
      }
    } else {
      for (const field of ['artifact_of_record_url', 'artifact_of_record_sha256', 'artifact_of_record_byte_length']) {
        if (resolution[field] !== null) {
          errors.push(`${label}: unresolved rows must leave ${field} null`);
        }
      }
    }
  }
  for (const id of inventoryIds) {
    if (!seen.has(id)) errors.push(`${id}: inventory candidate has no remediation row`);
  }

  const summary = remediation.summary || {};
  const byStatus = (status) => candidates.filter((row) => (row.resolution || {}).status === status).length;
  const attemptCount = candidates.reduce((count, row) => count + (row.attempts || []).length, 0);
  if (summary.candidates_attempted !== candidates.length) errors.push('summary.candidates_attempted must equal the remediation row count');
  if (summary.stable_artifact_of_record !== byStatus(STABLE_STATUS)) errors.push('summary.stable_artifact_of_record is inconsistent');
  if (summary.unstable_no_stable_export !== byStatus('unstable-no-stable-export')) errors.push('summary.unstable_no_stable_export is inconsistent');
  if (summary.unavailable_access_blocked !== byStatus('unavailable-access-blocked')) errors.push('summary.unavailable_access_blocked is inconsistent');
  if (summary.attempts_recorded !== attemptCount) errors.push('summary.attempts_recorded must equal the recorded attempt count');

  const unresolvedIds = (remediation.unresolved || []).map((row) => row.candidate_id).sort();
  const expectedUnresolved = candidates
    .filter((row) => (row.resolution || {}).status !== STABLE_STATUS)
    .map((row) => row.candidate_id)
    .sort();
  if (JSON.stringify(unresolvedIds) !== JSON.stringify(expectedUnresolved)) {
    errors.push('unresolved must list exactly the candidates that did not reach a stable artifact of record');
  }

  return { errors, summary };
}

function formatSummary(summary) {
  return [
    `candidates_attempted: ${summary.candidates_attempted}`,
    `stable_artifact_of_record: ${summary.stable_artifact_of_record}`,
    `unstable_no_stable_export: ${summary.unstable_no_stable_export}`,
    `unavailable_access_blocked: ${summary.unavailable_access_blocked}`,
    `new_stable_artifacts_obtained: ${summary.new_stable_artifacts_obtained}`,
    `captures_reverified_unchanged: ${summary.captures_reverified_unchanged}`,
    `prior_hash_match_confirmations: ${summary.prior_hash_match_confirmations}`,
    `attempts_recorded: ${summary.attempts_recorded}`
  ].join('\n');
}

if (require.main === module) {
  const { errors, summary } = validateRemediation();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(formatSummary(summary));
    console.log('PASS: artifact-capture remediation validates as machine-only with no rights-decision or mapping fields.');
  }
}

module.exports = {
  validateRemediation,
  formatSummary,
  REMEDIATION_PATH,
  INVENTORY_PATH
};