'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_QUEUE = path.join(
  __dirname,
  '..',
  'data',
  'evidence',
  'review-queues',
  'scenario-challenge-evidence-intake-20261003.json'
);

function validateQueue(doc) {
  if (doc?.queue_type !== 'scenario-challenge-evidence-intake') {
    throw new Error('Unexpected evidence-intake queue type.');
  }
  if (doc?.policy !== 'data/evidence/open-evidence-source-policy.json') {
    throw new Error('Evidence-intake queue must reference the governed evidence-source policy.');
  }
  if (!Array.isArray(doc.entries) || doc.entries.length !== 200) {
    throw new Error(`Expected 200 challenge drafts; received ${doc?.entries?.length ?? 0}.`);
  }

  const ids = new Set();
  const scenarios = new Set();
  let claimCount = 0;

  for (const [index, entry] of doc.entries.entries()) {
    const label = `Entry ${index + 1}`;
    if (typeof entry.synthetic_draft_id !== 'string' || !entry.synthetic_draft_id) {
      throw new Error(`${label} is missing synthetic_draft_id.`);
    }
    if (ids.has(entry.synthetic_draft_id)) {
      throw new Error(`${label} duplicates synthetic_draft_id ${entry.synthetic_draft_id}.`);
    }
    ids.add(entry.synthetic_draft_id);

    if (typeof entry.scenario_id !== 'string' || !entry.scenario_id) {
      throw new Error(`${label} is missing scenario_id.`);
    }
    scenarios.add(entry.scenario_id);

    if (![1, 2, 3, 4].includes(entry.batch_id)) {
      throw new Error(`${label} has invalid batch_id.`);
    }
    if (!Number.isInteger(entry.artifact_run_id) || entry.artifact_run_id <= 0) {
      throw new Error(`${label} has invalid artifact_run_id.`);
    }
    if (typeof entry.artifact_digest !== 'string' || !entry.artifact_digest.startsWith('sha256:')) {
      throw new Error(`${label} has invalid artifact_digest.`);
    }
    if (!Array.isArray(entry.claims_to_verify) || entry.claims_to_verify.length === 0 ||
        entry.claims_to_verify.some((claim) => typeof claim !== 'string' || claim.trim() === '')) {
      throw new Error(`${label} must contain nonblank claims_to_verify.`);
    }
    claimCount += entry.claims_to_verify.length;

    if (!Array.isArray(entry.candidate_sources) || entry.candidate_sources.length !== 0) {
      throw new Error(`${label} must begin with no candidate source assignments.`);
    }
    if (entry.mapping_status !== 'unmapped-source-discovery-required') {
      throw new Error(`${label} must remain unmapped at intake.`);
    }

    for (const field of [
      'evidence_mapping_completed',
      'citation_validation_completed',
      'human_technical_review_completed',
      'human_instructional_review_completed',
      'approved'
    ]) {
      if (entry[field] !== false) {
        throw new Error(`${label} must keep ${field}=false at intake.`);
      }
    }
  }

  if (scenarios.size !== 21) {
    throw new Error(`Expected 21 scenario banks; received ${scenarios.size}.`);
  }
  if (doc.summary?.draft_count !== 200 ||
      doc.summary?.scenario_count !== 21 ||
      doc.summary?.claim_count !== claimCount ||
      doc.summary?.mapped_count !== 0 ||
      doc.summary?.citation_validated_count !== 0 ||
      doc.summary?.approved_count !== 0) {
    throw new Error('Evidence-intake summary does not match queue contents.');
  }

  if (doc.governance?.training_mix_unblocked !== false ||
      doc.governance?.scoring_unblocked !== false ||
      doc.governance?.assessment_unblocked !== false) {
    throw new Error('Evidence-intake queue must remain fail-closed.');
  }

  return {
    draft_count: doc.entries.length,
    scenario_count: scenarios.size,
    claim_count: claimCount
  };
}

if (require.main === module) {
  const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_QUEUE;
  const doc = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const result = validateQueue(doc);
  console.log(`PASS: ${result.draft_count} drafts, ${result.scenario_count} scenarios, ${result.claim_count} claims; all review gates remain closed.`);
}

module.exports = { validateQueue, DEFAULT_QUEUE };