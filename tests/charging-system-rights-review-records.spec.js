const fs = require('fs');
const path = require('path');
const {
  validateRightsReviewRecords,
  formatSummary
} = require('../scripts/validate-charging-system-rights-review-records');

describe('charging-system rights-review records contract', () => {
  const root = path.resolve(__dirname, '..');
  const records = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-rights-review-records-20261003.json'),
    'utf8'
  ));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues',
      'charging-system-challenge-candidate-source-manifest-20261003.json'),
    'utf8'
  ));
  const intake = JSON.parse(fs.readFileSync(
    path.join(root, 'evidence', 'review-queues',
      'scenario-challenge-evidence-intake-20261003.json'),
    'utf8'
  ));

  test('passes the fail-closed rights-review validator', () => {
    const { errors } = validateRightsReviewRecords();
    expect(errors).toEqual([]);
  });

  test('covers every discovery candidate with a pending, reviewer-free row', () => {
    expect(records.stage).toBe('awaiting-human-rights-review');
    const reviewIds = records.reviews.map((row) => row.candidate_id).sort();
    const candidateIds = manifest.source_candidates.map((source) => source.candidate_id).sort();
    expect(reviewIds).toEqual(candidateIds);

    for (const row of records.reviews) {
      expect(row.rights_decision).toBe('pending');
      expect(row.reviewer_identity).toBeNull();
      expect(row.reviewed_at).toBeNull();
      expect(row.decided_rights_classification).toBeNull();
      expect(row.artifact_sha256).toBeNull();
      expect(row.scope_of_clearance).toBeNull();
      expect(row.store_verbatim_excerpt).toBe(false);
      expect(row.may_generate_questions).toBe(false);
      expect(row.approval_effect).toBe('none');
    }
  });

  test('records no rights decision and no downstream approval state', () => {
    expect(records.summary.rights_decisions_recorded).toBe(0);
    expect(records.summary.sources_cleared).toBe(0);
    expect(records.summary.sources_candidate_only).toBe(records.reviews.length);
    expect(records.summary.mapped_count).toBe(0);
    expect(records.summary.citation_validated_count).toBe(0);
    expect(records.summary.technical_reviewed_count).toBe(0);
    expect(records.summary.instructional_reviewed_count).toBe(0);
    expect(records.summary.approved_count).toBe(0);
    expect(records.summary.assessment_eligible_count).toBe(0);

    const output = formatSummary(records.summary);
    expect(output).toContain('sources_in_review: 6');
    expect(output).toContain('rights_decisions_recorded: 0');
    expect(output).toContain('mapped_count: 0');
  });

  test('holds no claim-to-source mapping on the rights-review branch', () => {
    for (const row of records.reviews) {
      for (const key of Object.keys(row)) {
        expect(key).not.toMatch(/claim|question_id|draft_id|mapping/i);
      }
    }
    expect(intake.summary.mapped_count).toBe(0);
    for (const entry of intake.entries.filter((row) => row.scenario_id === 'charging-system')) {
      expect(entry.mapping_status).toBe('unmapped-source-discovery-required');
      expect(entry.candidate_sources).toEqual([]);
    }
  });
});