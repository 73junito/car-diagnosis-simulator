'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const MANIFEST = [
  {
    batchId: 1,
    runId: 37087583590,
    artifactId: 11261312482,
    artifactName: 'scenario-challenge-batch-1-37087583590',
    artifactDigest: 'sha256:cd002c33c12e139a8d1b1352d8e4b8728b0c0081472e73217a468ff56856930a',
    payloadSha256: '8b896cf19ed6328c0107e676cc4225391a216e8240a43e0d8380fbe71e772710',
    fileName: 'batch-1.json'
  },
  {
    batchId: 2,
    runId: 37088059898,
    artifactId: 11260978832,
    artifactName: 'scenario-challenge-batch-2-37088059898',
    artifactDigest: 'sha256:d94b8b44af75080251f215894fee46e4cdac5061062433229dd1456869bec49c',
    payloadSha256: 'd4757e409a8ffe2441b0ac564189a8e3785fed65cb90c76641ff5d851723f634',
    fileName: 'batch-2.json'
  },
  {
    batchId: 3,
    runId: 37088465496,
    artifactId: 11260999553,
    artifactName: 'scenario-challenge-batch-3-37088465496',
    artifactDigest: 'sha256:c3d142ab5b659eff592a20bb21d8a4a167b30f37b2b912022bab8dad295b380e',
    payloadSha256: '37fdc75863ca4debae302c572e9a84a8666972bb7505f294df9ac2c2a3f6b4e7',
    fileName: 'batch-3.json'
  },
  {
    batchId: 4,
    runId: 37088851220,
    artifactId: 11261581961,
    artifactName: 'scenario-challenge-batch-4-37088851220',
    artifactDigest: 'sha256:b39e5cd460a5de756903e399093feeaf5db366be85378c02df5f10a75bf7575e',
    payloadSha256: '9d0ce44c8b4908b47264aaa8eca3bc1877783faa85625a5ec16ba2f774a49973',
    fileName: 'batch-4.json'
  }
];

const SOURCE_COMMIT = '83322281261d6877002ae58b8b0b72502755c52d';
const TABLE = 'scenario_challenge_review_artifacts';

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validatePayload(entry, text) {
  const bytes = Buffer.from(text, 'utf8');
  const actualHash = sha256Buffer(bytes);
  if (actualHash !== entry.payloadSha256) {
    throw new Error(`Batch ${entry.batchId} payload SHA-256 mismatch.`);
  }

  const doc = JSON.parse(text);
  if (doc?.generator?.batch_id !== entry.batchId) {
    throw new Error(`Batch ${entry.batchId} generator batch ID mismatch.`);
  }
  if (doc?.generator?.model !== 'gpt-oss:20b-cloud') {
    throw new Error(`Batch ${entry.batchId} model mismatch.`);
  }
  if (doc?.generator?.agent_version !== 'scenario-challenge-question-agent-v1') {
    throw new Error(`Batch ${entry.batchId} agent version mismatch.`);
  }
  if (!Array.isArray(doc.questions) || doc.questions.length !== 50) {
    throw new Error(`Batch ${entry.batchId} must contain exactly 50 questions.`);
  }

  for (const [index, question] of doc.questions.entries()) {
    const label = `Batch ${entry.batchId} question ${index + 1}`;
    if (
      question.status !== 'draft' ||
      question.support_status !== 'synthetic-draft-pending-evidence' ||
      question.eligible_for_training_mix !== false ||
      question.eligible_for_scoring !== false ||
      question.assessment_eligible !== false ||
      question.evidence_mapping_completed !== false ||
      question.citation_validation_completed !== false ||
      question.human_technical_review_completed !== false ||
      question.human_instructional_review_completed !== false ||
      question.approved !== false
    ) {
      throw new Error(`${label} violates the fail-closed review contract.`);
    }
  }

  return doc;
}

function validateExisting(entry, row) {
  const expected = {
    batch_id: entry.batchId,
    workflow_run_id: entry.runId,
    workflow_artifact_id: entry.artifactId,
    workflow_artifact_digest: entry.artifactDigest,
    payload_sha256: entry.payloadSha256,
    source_commit: SOURCE_COMMIT,
    model: 'gpt-oss:20b-cloud',
    agent_version: 'scenario-challenge-question-agent-v1',
    question_count: 50,
    status: 'synthetic-draft-review-only'
  };

  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) {
      throw new Error(`Existing batch ${entry.batchId} row has mismatched ${key}.`);
    }
  }

  if (sha256Buffer(Buffer.from(row.payload_text, 'utf8')) !== entry.payloadSha256) {
    throw new Error(`Existing batch ${entry.batchId} stored payload hash does not match.`);
  }
}

async function verifyGithubArtifact(entry, token) {
  const response = await fetch(
    `https://api.github.com/repos/73junito/car-diagnosis-simulator/actions/artifacts/${entry.artifactId}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub artifact metadata request failed for batch ${entry.batchId}: HTTP ${response.status}.`);
  }

  const artifact = await response.json();
  if (
    artifact.id !== entry.artifactId ||
    artifact.name !== entry.artifactName ||
    artifact.digest !== entry.artifactDigest ||
    artifact.expired !== false ||
    artifact.workflow_run?.id !== entry.runId ||
    artifact.workflow_run?.head_sha !== SOURCE_COMMIT
  ) {
    throw new Error(`GitHub artifact metadata mismatch for batch ${entry.batchId}.`);
  }
}

async function main() {
  const rootArg = process.argv.find((arg) => arg.startsWith('--root='));
  const root = path.resolve(rootArg ? rootArg.slice('--root='.length) : 'downloaded-artifacts');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !githubToken) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GITHUB_TOKEN are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  for (const entry of MANIFEST) {
    await verifyGithubArtifact(entry, githubToken);

    const payloadPath = path.join(root, String(entry.runId), entry.fileName);
    const payloadBuffer = fs.readFileSync(payloadPath);
    const payloadText = payloadBuffer.toString('utf8');

    if (sha256Buffer(payloadBuffer) !== entry.payloadSha256) {
      throw new Error(`Batch ${entry.batchId} downloaded file hash does not match manifest.`);
    }

    const doc = validatePayload(entry, payloadText);

    const { data: existing, error: selectError } = await supabase
      .from(TABLE)
      .select('batch_id,workflow_run_id,workflow_artifact_id,workflow_artifact_digest,payload_sha256,source_commit,model,agent_version,question_count,status,payload_text')
      .eq('batch_id', entry.batchId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Batch ${entry.batchId} existing-row lookup failed: ${selectError.message}`);
    }

    if (existing) {
      validateExisting(entry, existing);
      console.log(`Batch ${entry.batchId}: already stored and verified.`);
      continue;
    }

    const { error: insertError } = await supabase.from(TABLE).insert({
      batch_id: entry.batchId,
      workflow_run_id: entry.runId,
      workflow_artifact_id: entry.artifactId,
      workflow_artifact_digest: entry.artifactDigest,
      payload_sha256: entry.payloadSha256,
      source_commit: SOURCE_COMMIT,
      provider: 'ollama-cloud',
      model: doc.generator.model,
      agent_version: doc.generator.agent_version,
      question_count: doc.questions.length,
      status: 'synthetic-draft-review-only',
      payload_text: payloadText
    });

    if (insertError) {
      throw new Error(`Batch ${entry.batchId} insert failed: ${insertError.message}`);
    }

    console.log(`Batch ${entry.batchId}: stored and verified.`);
  }

  const { data: rows, error: verifyError } = await supabase
    .from(TABLE)
    .select('batch_id,workflow_run_id,workflow_artifact_id,workflow_artifact_digest,payload_sha256,source_commit,model,agent_version,question_count,status,payload_text')
    .order('batch_id');

  if (verifyError) {
    throw new Error(`Final verification query failed: ${verifyError.message}`);
  }
  if (!Array.isArray(rows) || rows.length !== 4) {
    throw new Error(`Expected exactly 4 durable review artifacts; received ${rows?.length ?? 0}.`);
  }

  for (const entry of MANIFEST) {
    const row = rows.find((item) => item.batch_id === entry.batchId);
    if (!row) throw new Error(`Missing durable row for batch ${entry.batchId}.`);
    validateExisting(entry, row);
  }

  console.log('PASS: 4 private durable challenge artifacts verified; 200 questions remain review-only and fail-closed.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { MANIFEST, SOURCE_COMMIT, validatePayload, validateExisting, sha256Buffer };