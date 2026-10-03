const fs = require('fs');
const { validateQueue, DEFAULT_QUEUE } = require('../scripts/validate-scenario-challenge-evidence-intake');

describe('scenario challenge evidence intake', () => {
  const queue = JSON.parse(fs.readFileSync(DEFAULT_QUEUE, 'utf8'));

  test('contains all 200 generated drafts across 21 scenarios and stays fail-closed', () => {
    expect(validateQueue(queue)).toEqual({
      draft_count: 200,
      scenario_count: 21,
      claim_count: 281
    });
  });

  test('does not silently assign evidence or approve any generated draft', () => {
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

  test('retains provenance back to the four successful workflow artifacts', () => {
    const runs = [...new Set(queue.entries.map((entry) => entry.artifact_run_id))].sort();
    expect(runs).toEqual([37087583590, 37088059898, 37088465496, 37088851220]);
    expect(new Set(queue.entries.map((entry) => entry.artifact_digest)).size).toBe(4);
  });
});