const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateRightsReviewRecords,
  formatSummary
} = require('../scripts/validate-charging-system-rights-review-records');

describe('charging-system rights-review records contract', () => {
  const root = path.resolve(__dirname, '..');
  const recordsPath = path.join(root, 'data', 'evidence', 'review-queues',
    'charging-system-rights-review-records-20261003.json');
  const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
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

  function validateMutated(mutator) {
    const clone = JSON.parse(JSON.stringify(records));
    mutator(clone);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rights-review-'));
    const file = path.join(dir, 'records.json');
    fs.writeFileSync(file, JSON.stringify(clone, null, 2));
    try {
      return validateRightsReviewRecords({ recordsPath: file });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  test('passes the fail-closed rights-review validator', () => {
    const { errors } = validateRightsReviewRecords();
    expect(errors).toEqual([]);
  });

  test('uses the pinned scope-specific clearance vocabulary', () => {
    expect(records.permitted_rights_classifications).toEqual([
      'pending',
      'cleared-link-citation-only',
      'cleared-metadata-only',
      'cleared-text-excerpt',
      'cleared-full-text-storage',
      'cleared-rag-use',
      'cleared-commercial-reuse',
      'restricted',
      'rejected'
    ]);
  });

  test('records the approved DOE, Flinn, Frontiers, and Army human decisions and leaves two rows pending', () => {
    const doe = records.reviews.find((row) =>
      row.candidate_id === 'doe-hdbk-1084-95-primer-lead-acid');
    expect(doe).toMatchObject({
      rights_decision: 'cleared-link-citation-only',
      decided_rights_classification: 'cleared-link-citation-only',
      reviewer_identity: 'Rafael Rodriguez Jr.',
      reviewed_at: '2026-10-03T21:05:04Z',
      artifact_sha256: 'ef3502149e9b2bea09e32818872c33ff75655414ac48dd50d32a6a6613ca3dc1',
      store_verbatim_excerpt: false,
      may_generate_questions: false,
      approval_effect: 'none'
    });

    const flinn = records.reviews.find((row) =>
      row.candidate_id === 'bccampus-flinn-alternator-2018');
    expect(flinn).toMatchObject({
      rights_decision: 'cleared-commercial-reuse',
      decided_rights_classification: 'cleared-commercial-reuse',
      reviewer_identity: 'Rafael Rodriguez Jr.',
      reviewed_at: '2026-10-03T21:23:40Z',
      artifact_sha256: 'c3883af5dfcfad17f6360e718aea6a20dab4832f8f020fc09253e909a663c344',
      store_verbatim_excerpt: false,
      may_generate_questions: false,
      approval_effect: 'none'
    });
    expect(flinn.scope_of_clearance).toContain('CC BY 4.0');
    expect(flinn.scope_of_clearance).toContain('separate review');
    expect(flinn.review_notes).toContain('Human review approved by Rafael Rodriguez Jr.');

    const frontiers = records.reviews.find((row) =>
      row.candidate_id === 'frontiers-automotive-alternator-2023');
    expect(frontiers).toMatchObject({
      rights_decision: 'cleared-commercial-reuse',
      decided_rights_classification: 'cleared-commercial-reuse',
      reviewer_identity: 'Rafael Rodriguez Jr.',
      reviewed_at: '2026-10-03T21:45:10Z',
      artifact_sha256: '9a0764fb555fb8676390325c61b4a98667b12de42d59768c475149b184096036',
      store_verbatim_excerpt: false,
      may_generate_questions: false,
      approval_effect: 'none'
    });
    expect(frontiers.scope_of_clearance).toContain('CC BY 4.0');
    expect(frontiers.scope_of_clearance).toContain('third-party material');
    expect(frontiers.review_notes).toContain('stable exact-source HTML publisher artifact');
    expect(frontiers.review_notes).toContain('different PDF representation');

    const army = records.reviews.find((row) =>
      row.candidate_id === 'army-da-pam-750-33-1976');
    expect(army).toMatchObject({
      rights_decision: 'cleared-text-excerpt',
      decided_rights_classification: 'cleared-text-excerpt',
      reviewer_identity: 'Rafael Rodriguez Jr.',
      reviewed_at: '2026-10-03T23:34:29Z',
      artifact_sha256: 'cbcac329d964a20087cc879db73f758e64a70f620afb94d0a7b8234f0934edd1',
      store_verbatim_excerpt: false,
      may_generate_questions: false,
      approval_effect: 'none'
    });
    expect(army.scope_of_clearance).toContain('Textual portions of DA PAM 750-33');
    expect(army.scope_of_clearance).toContain('does not extend to photographs');
    expect(army.review_notes).toContain('Human review approved by Rafael Rodriguez Jr.');

    const pending = records.reviews.filter((row) => row.rights_decision === 'pending');
    expect(pending).toHaveLength(2);
    for (const row of pending) {
      expect(row.reviewer_identity).toBeNull();
      expect(row.reviewed_at).toBeNull();
      expect(row.decided_rights_classification).toBeNull();
      expect(row.artifact_sha256).toBeNull();
      expect(row.scope_of_clearance).toBeNull();
      expect(row.review_notes).toBeNull();
    }
  });

  test('summary reflects four rights decisions without advancing downstream gates', () => {
    expect(records.summary.rights_decisions_recorded).toBe(4);
    expect(records.summary.sources_cleared).toBe(4);
    expect(records.summary.sources_candidate_only).toBe(2);
    expect(records.summary.mapped_count).toBe(0);
    expect(records.summary.citation_validated_count).toBe(0);
    expect(records.summary.technical_reviewed_count).toBe(0);
    expect(records.summary.instructional_reviewed_count).toBe(0);
    expect(records.summary.approved_count).toBe(0);
    expect(records.summary.assessment_eligible_count).toBe(0);

    const output = formatSummary(records.summary);
    expect(output).toContain('rights_decisions_recorded: 4');
    expect(output).toContain('sources_candidate_only: 2');
    expect(output).toContain('mapped_count: 0');
  });

  test('covers every discovery candidate and holds no claim-to-source mapping', () => {
    const reviewIds = records.reviews.map((row) => row.candidate_id).sort();
    const candidateIds = manifest.source_candidates.map((source) => source.candidate_id).sort();
    expect(reviewIds).toEqual(candidateIds);

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

  test('permits a null hash for link-citation-only clearance', () => {
    const { errors } = validateMutated((clone) => {
      const doe = clone.reviews.find((row) =>
        row.candidate_id === 'doe-hdbk-1084-95-primer-lead-acid');
      doe.artifact_sha256 = null;
    });
    expect(errors).toEqual([]);
  });

  test('requires an artifact hash for content-dependent clearance scopes', () => {
    const { errors } = validateMutated((clone) => {
      const doe = clone.reviews.find((row) =>
        row.candidate_id === 'doe-hdbk-1084-95-primer-lead-acid');
      doe.rights_decision = 'cleared-full-text-storage';
      doe.decided_rights_classification = 'cleared-full-text-storage';
      doe.artifact_sha256 = null;
    });
    expect(errors.some((error) => error.includes('requires a 64-character lowercase artifact_sha256'))).toBe(true);
  });

  test('requires a real reviewer identity and matching decided classification', () => {
    const result = validateMutated((clone) => {
      const doe = clone.reviews.find((row) =>
        row.candidate_id === 'doe-hdbk-1084-95-primer-lead-acid');
      doe.reviewer_identity = '';
      doe.decided_rights_classification = 'cleared-metadata-only';
    });
    expect(result.errors.some((error) => error.includes('named human reviewer_identity'))).toBe(true);
    expect(result.errors.some((error) => error.includes('must equal rights_decision'))).toBe(true);
  });
});
