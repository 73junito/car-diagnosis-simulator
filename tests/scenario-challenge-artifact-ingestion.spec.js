const fs = require('fs');
const path = require('path');
const {
  MANIFEST,
  SOURCE_COMMIT,
  validatePayload,
  validateExisting,
  sha256Buffer
} = require('../scripts/ingest-scenario-challenge-review-artifacts');

describe('private scenario challenge artifact ingestion contract', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'ingest-scenario-challenge-review-artifacts.yml'),
    'utf8'
  );

  test('is manual-only and production-environment scoped', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/\npush:/);
    expect(workflow).not.toMatch(/\npull_request:/);
    expect(workflow).not.toMatch(/\nschedule:/);
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('actions: read');
  });

  test('downloads only the four pinned successful artifacts', () => {
    expect(MANIFEST).toHaveLength(4);
    expect(MANIFEST.map((item) => item.runId)).toEqual([37087583590, 37088059898, 37088465496, 37088851220]);
    expect(MANIFEST.map((item) => item.batchId)).toEqual([1, 2, 3, 4]);
    for (const item of MANIFEST) {
      expect(item.artifactDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(item.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(workflow).toContain('gh run download ' + item.runId);
      expect(workflow).toContain(item.artifactName);
    }
    expect(SOURCE_COMMIT).toMatch(/^[a-f0-9]{40}$/);
  });

  test('uses the production service-role secret without printing payloads or secrets', () => {
    expect(workflow).toContain('SUPABASE_URL: ${{ secrets.PRODUCTION_URL }}');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PRODUCTION_SECRET || secrets.PRODUCTION_KEY }}');
    expect(workflow).not.toContain('cat downloaded-artifacts');
  });

  test('validates exact byte hashes and the fail-closed question contract', () => {
    const item = MANIFEST[0];
    const question = {
      status: 'draft', support_status: 'synthetic-draft-pending-evidence',
      eligible_for_training_mix: false, eligible_for_scoring: false,
      assessment_eligible: false, evidence_mapping_completed: false,
      citation_validation_completed: false, human_technical_review_completed: false,
      human_instructional_review_completed: false, approved: false
    };
    const doc = {
      generator: { batch_id: 1, model: 'gpt-oss:20b-cloud', agent_version: 'scenario-challenge-question-agent-v1' },
      questions: Array.from({ length: 50 }, () => ({ ...question }))
    };
    const text = JSON.stringify(doc);
    const testItem = { ...item, payloadSha256: sha256Buffer(Buffer.from(text, 'utf8')) };
    expect(validatePayload(testItem, text).questions).toHaveLength(50);

    const bad = JSON.parse(text);
    bad.questions[0].approved = true;
    const badText = JSON.stringify(bad);
    expect(() => validatePayload(
      { ...testItem, payloadSha256: sha256Buffer(Buffer.from(badText, 'utf8')) },
      badText
    )).toThrow('violates the fail-closed review contract');
  });

  test('requires an existing durable row to match pinned provenance and payload bytes', () => {
    const item = MANIFEST[0];
    const payloadText = 'x';
    const altered = { ...item, payloadSha256: sha256Buffer(Buffer.from(payloadText, 'utf8')) };
    const row = {
      batch_id: altered.batchId, workflow_run_id: altered.runId,
      workflow_artifact_id: altered.artifactId, workflow_artifact_digest: altered.artifactDigest,
      payload_sha256: altered.payloadSha256, source_commit: SOURCE_COMMIT,
      model: 'gpt-oss:20b-cloud', agent_version: 'scenario-challenge-question-agent-v1',
      question_count: 50, status: 'synthetic-draft-review-only', payload_text: payloadText
    };
    expect(() => validateExisting(altered, row)).not.toThrow();
    expect(() => validateExisting(item, row)).toThrow();
  });
});
