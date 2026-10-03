'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_QUEUE = path.join(__dirname, '..', 'evidence', 'review-queues', 'scenario-challenge-evidence-intake-20261003.json');
const PLAN_PATH = path.join(__dirname, '..', 'data', 'generated', 'scenario-challenge-batch-plan.json');
const PRIVATE_STORE_TABLE = 'public.scenario_challenge_review_artifacts';

const EXPECTED_ARTIFACTS = new Map([
  [1, { run_id: 37087583590, artifact_id: 11261312482, digest: 'sha256:cd002c33c12e139a8d1b1352d8e4b8728b0c0081472e73217a468ff56856930a', payload_sha256: '8b896cf19ed6328c0107e676cc4225391a216e8240a43e0d8380fbe71e772710' }],
  [2, { run_id: 37088059898, artifact_id: 11260978832, digest: 'sha256:d94b8b44af75080251f215894fee46e4cdac5061062433229dd1456869bec49c', payload_sha256: 'd4757e409a8ffe2441b0ac564189a8e3785fed65cb90c76641ff5d851723f634' }],
  [3, { run_id: 37088465496, artifact_id: 11260999553, digest: 'sha256:c3d142ab5b659eff592a20bb21d8a4a167b30f37b2b912022bab8dad295b380e', payload_sha256: '37fdc75863ca4debae302c572e9a84a8666972bb7505f294df9ac2c2a3f6b4e7' }],
  [4, { run_id: 37088851220, artifact_id: 11261581961, digest: 'sha256:b39e5cd460a5de756903e399093feeaf5db366be85378c02df5f10a75bf7575e', payload_sha256: '9d0ce44c8b4908b47264aaa8eca3bc1877783faa85625a5ec16ba2f774a49973' }]
]);

const MOJIBAKE_PATTERN = /(?:â€|Â|Î|�)/;

function validateQueue(doc, plan) {
  if (doc?.queue_type !== 'scenario-challenge-evidence-intake') throw new Error('Unexpected evidence-intake queue type.');
  if (doc?.policy !== 'data/evidence/open-evidence-source-policy.json') throw new Error('Evidence-intake queue must reference the governed evidence-source policy.');
  if (!Array.isArray(doc.entries) || doc.entries.length !== 200) throw new Error(`Expected 200 challenge drafts; received ${doc?.entries?.length ?? 0}.`);
  if (!plan || !Array.isArray(plan.batches) || !Array.isArray(plan.scenario_banks)) throw new Error('Scenario challenge batch plan is invalid.');

  const ids = new Set();
  const counts = new Map();
  let claimCount = 0;

  for (const [index, entry] of doc.entries.entries()) {
    const label = `Entry ${index + 1}`;
    if (typeof entry.synthetic_draft_id !== 'string' || !entry.synthetic_draft_id) throw new Error(`${label} is missing synthetic_draft_id.`);
    if (ids.has(entry.synthetic_draft_id)) throw new Error(`${label} duplicates synthetic_draft_id ${entry.synthetic_draft_id}.`);
    ids.add(entry.synthetic_draft_id);

    if (!plan.scenario_banks.includes(entry.scenario_id)) throw new Error(`${label} has unexpected scenario_id ${entry.scenario_id}.`);
    if (![1, 2, 3, 4].includes(entry.batch_id)) throw new Error(`${label} has invalid batch_id.`);

    const expected = EXPECTED_ARTIFACTS.get(entry.batch_id);
    if (entry.artifact_run_id !== expected.run_id || entry.artifact_digest !== expected.digest || !/^sha256:[a-f0-9]{64}$/.test(entry.artifact_digest)) {
      throw new Error(`${label} does not match the expected workflow artifact provenance.`);
    }
    if (typeof entry.artifact_retention_expires_at !== 'string' || !entry.artifact_retention_expires_at) throw new Error(`${label} is missing temporary artifact expiry metadata.`);

    const ref = entry.durable_source_ref;
    if (!ref || ref.table !== PRIVATE_STORE_TABLE || ref.batch_id !== entry.batch_id || ref.payload_sha256 !== expected.payload_sha256 || !/^[a-f0-9]{64}$/.test(ref.payload_sha256)) {
      throw new Error(`${label} does not match verified private-store provenance.`);
    }

    if (!Array.isArray(entry.claims_to_verify) || entry.claims_to_verify.length === 0 || entry.claims_to_verify.some((claim) => typeof claim !== 'string' || claim.trim() === '')) {
      throw new Error(`${label} must contain nonblank claims_to_verify.`);
    }
    for (const claim of entry.claims_to_verify) if (MOJIBAKE_PATTERN.test(claim)) throw new Error(`${label} contains mojibake in claims_to_verify.`);
    claimCount += entry.claims_to_verify.length;

    if (!Array.isArray(entry.candidate_sources) || entry.candidate_sources.length !== 0) throw new Error(`${label} must begin with no candidate source assignments.`);
    if (entry.mapping_status !== 'unmapped-source-discovery-required') throw new Error(`${label} must remain unmapped pending source discovery.`);

    for (const field of ['evidence_mapping_completed','citation_validation_completed','human_technical_review_completed','human_instructional_review_completed','approved']) {
      if (entry[field] !== false) throw new Error(`${label} must keep ${field}=false at intake.`);
    }

    const key = `${entry.batch_id}:${entry.scenario_id}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (const batch of plan.batches) {
    for (const [scenarioId, expectedCount] of Object.entries(batch.allocation)) {
      const actual = counts.get(`${batch.batch_id}:${scenarioId}`) || 0;
      if (actual !== expectedCount) throw new Error(`Batch ${batch.batch_id} scenario ${scenarioId} expected ${expectedCount}; received ${actual}.`);
    }
  }

  const artifactRows = Array.isArray(doc.artifact_provenance) ? doc.artifact_provenance : [];
  if (artifactRows.length !== EXPECTED_ARTIFACTS.size) throw new Error('Artifact provenance must contain exactly four batch records.');
  for (const [batchId, expected] of EXPECTED_ARTIFACTS.entries()) {
    const row = artifactRows.find((item) => item.batch_id === batchId);
    if (!row || row.run_id !== expected.run_id || row.workflow_artifact_id !== expected.artifact_id || row.digest !== expected.digest || row.payload_sha256 !== expected.payload_sha256 || row.private_store_table !== PRIVATE_STORE_TABLE || row.private_store_batch_id !== batchId || row.private_store_verified !== true) {
      throw new Error(`Artifact provenance for batch ${batchId} is invalid.`);
    }
  }

  if (doc.summary?.draft_count !== 200 || doc.summary?.scenario_count !== plan.scenario_banks.length || doc.summary?.claim_count !== claimCount || doc.summary?.mapped_count !== 0 || doc.summary?.citation_validated_count !== 0 || doc.summary?.approved_count !== 0) {
    throw new Error('Evidence-intake summary does not match queue contents.');
  }

  for (const field of ['source_discovery_required','candidate_source_assignment_is_not_evidence_approval','rights_review_required','technical_review_required','citation_validation_required','durable_private_source_artifact_required','question_text_not_duplicated_in_queue']) {
    if (doc.governance?.[field] !== true) throw new Error(`Evidence-intake governance requires ${field}=true.`);
  }
  for (const field of ['training_mix_unblocked','scoring_unblocked','assessment_unblocked']) {
    if (doc.governance?.[field] !== false) throw new Error(`Evidence-intake governance requires ${field}=false.`);
  }

  const storage = doc.storage_boundary;
  if (storage?.repository_visibility !== 'public' || storage?.full_question_payload_committed !== false || storage?.durable_private_source_storage_status !== 'verified-supabase-private' || storage?.source_discovery_blocked_until_durable_private_storage !== false || storage?.private_store_table !== PRIVATE_STORE_TABLE || storage?.private_store_row_count !== 4 || storage?.private_store_access !== 'service_role_select_insert_only' || storage?.private_store_rls_enabled !== true || storage?.private_store_policy_count !== 0) {
    throw new Error('Storage boundary does not match the verified private artifact store.');
  }

  return { draft_count: doc.entries.length, scenario_count: plan.scenario_banks.length, claim_count: claimCount };
}

if (require.main === module) {
  const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_QUEUE;
  const doc = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  const result = validateQueue(doc, plan);
  console.log(`PASS: ${result.draft_count} drafts, ${result.scenario_count} scenarios, ${result.claim_count} claims; private artifact storage verified, evidence/citation/review gates remain closed.`);
}

module.exports = { validateQueue, DEFAULT_QUEUE, PLAN_PATH, EXPECTED_ARTIFACTS, PRIVATE_STORE_TABLE, MOJIBAKE_PATTERN };