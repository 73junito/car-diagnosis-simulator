const fs = require('fs');
const {
  validateQueue,
  DEFAULT_QUEUE,
  PLAN_PATH,
  EXPECTED_ARTIFACTS,
  MOJIBAKE_PATTERN
} = require('../scripts/validate-scenario-challenge-evidence-intake');

describe('scenario challenge evidence intake', () => {
  const queue = JSON.parse(fs.readFileSync(DEFAULT_QUEUE, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));

  test('contains the exact planned allocation for all 200 generated drafts', () => {
    expect(validateQueue(queue, plan)).toEqual({
      draft_count: 200,
      scenario_count: 21,
      claim_count: 281
    });

    for (const batch of plan.batches) {
      for (const [scenarioId, expected] of Object.entries(batch.allocation)) {
        const actual = queue.entries.filter(
          (entry) => entry.batch_id === batch.batch_id && entry.scenario_id === scenarioId
        ).length;
        expect(actual).toBe(expected);
      }
    }
  });

  test('binds every draft to the exact successful workflow artifact', () => {
    for (const entry of queue.entries) {
      const expected = EXPECTED_ARTIFACTS.get(entry.batch_id);
      expect(entry.artifact_run_id).toBe(expected.run_id);
      expect(entry.artifact_digest).toBe(expected.digest);
      expect(entry.artifact_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  test('opens governed source discovery only after durable private storage verification while release gates stay closed', () => {
    expect(queue.storage_boundary.durable_private_source_storage_status).toBe('verified');
    expect(queue.storage_boundary.source_discovery_blocked_until_durable_private_storage).toBe(false);
    expect(queue.storage_boundary.private_storage_reference.verified_row_count).toBe(4);
    expect(queue.storage_boundary.private_storage_reference.verified_question_count).toBe(200);
    expect(queue.storage_boundary.private_storage_reference.payload_hashes_verified).toBe(true);
    expect(queue.governance.source_discovery_required).toBe(true);
    expect(queue.governance.rights_review_required).toBe(true);
    expect(queue.governance.technical_review_required).toBe(true);
    expect(queue.governance.citation_validation_required).toBe(true);
    expect(queue.governance.durable_private_source_artifact_required).toBe(true);

    for (const entry of queue.entries) {
      expect(entry.candidate_sources).toEqual([]);
      expect(entry.mapping_status).toBe('unmapped-source-discovery-required');
      expect(entry.evidence_mapping_completed).toBe(false);
      expect(entry.citation_validation_completed).toBe(false);
      expect(entry.human_technical_review_completed).toBe(false);
      expect(entry.human_instructional_review_completed).toBe(false);
      expect(entry.approved).toBe(false);
    }
  });

  test('contains clean UTF-8 claim text without known mojibake markers', () => {
    for (const entry of queue.entries) {
      for (const claim of entry.claims_to_verify) {
        expect(claim).not.toMatch(MOJIBAKE_PATTERN);
      }
    }
  });
});