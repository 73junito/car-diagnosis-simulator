'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-artifact-capture-inventory-20261003.json');
const MANIFEST_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-challenge-candidate-source-manifest-20261003.json');

const CAPTURE_STATUSES = ['captured', 'unavailable'];
const CAPTURE_KINDS = ['exact-source', 'mirror', 'metadata-only', 'unavailable'];
const CAPTURED_KINDS = ['exact-source', 'mirror'];

// Artifact facts only: no claim/draft/mapping/technical-review/approval/eligibility fields.
const FORBIDDEN_KEY = /claim|draft|question_id|mapping|technical|instructional|approv|eligib|rights_decision|reviewer_identity/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

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

function validateCaptureInventory(options = {}) {
  const inventoryPath = options.inventoryPath || INVENTORY_PATH;
  const manifestPath = options.manifestPath || MANIFEST_PATH;
  const errors = [];

  const inventory = readJson(inventoryPath, errors, 'artifact-capture inventory');
  const manifest = readJson(manifestPath, errors, 'candidate-source manifest');
  if (errors.length > 0) return { errors, summary: null };

  if (inventory.artifact_type !== 'candidate-source-artifact-capture-inventory') {
    errors.push(`artifact_type must be candidate-source-artifact-capture-inventory; received ${inventory.artifact_type}`);
  }
  if (inventory.scenario_id !== 'charging-system') {
    errors.push(`scenario_id must be charging-system; received ${inventory.scenario_id}`);
  }
  if (inventory.stage !== 'artifact-capture-pending-human-rights-review') {
    errors.push(`stage must be artifact-capture-pending-human-rights-review; received ${inventory.stage}`);
  }

  walkKeys(inventory, (key, trail) => {
    if (FORBIDDEN_KEY.test(key)) errors.push(`${trail}: inventory must not contain field ${key}`);
  });

  const artifacts = Array.isArray(inventory.artifacts) ? inventory.artifacts : null;
  if (!artifacts || artifacts.length === 0) {
    errors.push('artifacts must be a non-empty array');
    return { errors, summary: null };
  }

  const manifestById = new Map((manifest.source_candidates || [])
    .map((source) => [source.candidate_id, source]));
  const seen = new Set();

  for (const row of artifacts) {
    const label = row.candidate_id || '<artifact missing candidate_id>';
    if (!row.candidate_id) errors.push('every artifact row must record a candidate_id');
    else if (seen.has(row.candidate_id)) errors.push(`${label}: duplicate artifact row`);
    else seen.add(row.candidate_id);

    const source = manifestById.get(row.candidate_id);
    if (!source) {
      errors.push(`${label}: not present in the discovery manifest source_candidates`);
    } else if (row.canonical_url !== source.canonical_url) {
      errors.push(`${label}: canonical_url must match the discovery manifest canonical_url`);
    }

    for (const field of ['canonical_url', 'retrieval_url', 'retrieved_at', 'artifact_filename',
      'capture_note']) {
      if (typeof row[field] !== 'string' || row[field].trim() === '') {
        errors.push(`${label}: required field ${field} must be recorded`);
      }
    }
    if (!ISO_TIMESTAMP_PATTERN.test(String(row.retrieved_at))) {
      errors.push(`${label}: retrieved_at must be an ISO-8601 UTC timestamp`);
    }
    if (!/^https:\/\//.test(String(row.retrieval_url))) {
      errors.push(`${label}: retrieval_url must be an https URL`);
    }
    if (!CAPTURE_STATUSES.includes(row.artifact_capture_status)) {
      errors.push(`${label}: artifact_capture_status must be one of ${CAPTURE_STATUSES.join(', ')}`);
    }
    if (!CAPTURE_KINDS.includes(row.capture_kind)) {
      errors.push(`${label}: capture_kind must be one of ${CAPTURE_KINDS.join(', ')}`);
    }
    if (row.artifact_byte_length !== null && !(Number.isInteger(row.artifact_byte_length) && row.artifact_byte_length > 0)) {
      errors.push(`${label}: artifact_byte_length must be a positive integer or null`);
    }
    if (row.retrieval_http_status !== null && !Number.isInteger(row.retrieval_http_status)) {
      errors.push(`${label}: retrieval_http_status must be an integer or null`);
    }

    if (row.artifact_capture_status === 'captured') {
      if (!SHA256_PATTERN.test(String(row.artifact_sha256))) {
        errors.push(`${label}: captured rows must record a 64-character lowercase SHA-256`);
      }
      if (!Number.isInteger(row.artifact_byte_length) || row.artifact_byte_length <= 0) {
        errors.push(`${label}: captured rows must record a positive artifact_byte_length`);
      }
      if (!row.artifact_media_type) errors.push(`${label}: captured rows must record artifact_media_type`);
      if (!CAPTURED_KINDS.includes(row.capture_kind)) {
        errors.push(`${label}: captured rows must use capture_kind exact-source or mirror`);
      }
      if (row.repeat_retrieval_hash_stable === false && !row.canonical_vs_retrieved_mismatch) {
        errors.push(`${label}: an unstable repeat hash must be explained in canonical_vs_retrieved_mismatch`);
      }
    } else if (row.artifact_capture_status === 'unavailable') {
      if (row.artifact_sha256 !== null) errors.push(`${label}: unavailable rows must not record a SHA-256`);
      if (!row.unavailable_reason) errors.push(`${label}: unavailable rows must record unavailable_reason`);
      if (!['metadata-only', 'unavailable'].includes(row.capture_kind)) {
        errors.push(`${label}: unavailable rows must use capture_kind metadata-only or unavailable`);
      }
      if (row.capture_kind === 'metadata-only' && !row.metadata_only_evidence) {
        errors.push(`${label}: metadata-only rows must record metadata_only_evidence`);
      }
    }
  }

  for (const id of manifestById.keys()) {
    if (!seen.has(id)) errors.push(`${id}: discovery manifest candidate has no artifact-capture row`);
  }

  const summary = inventory.summary || {};
  const captured = artifacts.filter((row) => row.artifact_capture_status === 'captured');
  const byKind = (kind) => artifacts.filter((row) => row.capture_kind === kind).length;
  if (summary.sources_in_inventory !== artifacts.length) errors.push('summary.sources_in_inventory must equal the artifact row count');
  if (summary.artifacts_captured !== captured.length) errors.push('summary.artifacts_captured must equal the captured row count');
  if (summary.artifacts_unavailable !== artifacts.length - captured.length) errors.push('summary.artifacts_unavailable must equal the unavailable row count');
  if (summary.capture_kind_exact_source !== byKind('exact-source')) errors.push('summary.capture_kind_exact_source is inconsistent');
  if (summary.capture_kind_mirror !== byKind('mirror')) errors.push('summary.capture_kind_mirror is inconsistent');
  if (summary.capture_kind_metadata_only !== byKind('metadata-only')) errors.push('summary.capture_kind_metadata_only is inconsistent');
  if (summary.capture_kind_unavailable !== byKind('unavailable')) errors.push('summary.capture_kind_unavailable is inconsistent');

  return { errors, summary };
}

function formatSummary(summary) {
  return [
    `sources_in_inventory: ${summary.sources_in_inventory}`,
    `artifacts_captured: ${summary.artifacts_captured}`,
    `artifacts_unavailable: ${summary.artifacts_unavailable}`,
    `capture_kind_exact_source: ${summary.capture_kind_exact_source}`,
    `capture_kind_mirror: ${summary.capture_kind_mirror}`,
    `capture_kind_metadata_only: ${summary.capture_kind_metadata_only}`,
    `capture_kind_unavailable: ${summary.capture_kind_unavailable}`,
    `captured_with_stable_hash: ${summary.captured_with_stable_hash}`,
    `captured_with_unstable_hash: ${summary.captured_with_unstable_hash}`
  ].join('\n');
}

if (require.main === module) {
  const { errors, summary } = validateCaptureInventory();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(formatSummary(summary));
    console.log('PASS: artifact-capture inventory validates as machine-only with no rights-decision or mapping fields.');
  }
}

module.exports = {
  validateCaptureInventory,
  formatSummary,
  INVENTORY_PATH,
  MANIFEST_PATH
};