const fs = require('fs');
const path = require('path');
const {
  validateManifest,
  formatSummary
} = require('../scripts/validate-charging-system-candidate-source-manifest');

describe('charging-system candidate-source manifest contract', () => {
  const root = path.resolve(__dirname, '..');
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

  test('passes the discovery-only validator', () => {
    const { errors } = validateManifest();
    expect(errors).toEqual([]);
  });

  test('keeps the slice bounded and every approval gate at zero', () => {
    expect(manifest.stage).toBe('candidate-source-discovery-only');
    expect(manifest.claim_candidates.length).toBeGreaterThanOrEqual(10);
    expect(manifest.claim_candidates.length).toBeLessThanOrEqual(15);
    expect(manifest.summary.claims_in_slice).toBe(manifest.claim_candidates.length);
    expect(manifest.summary.mapped_count).toBe(0);
    expect(manifest.summary.citation_validated_count).toBe(0);
    expect(manifest.summary.technical_reviewed_count).toBe(0);
    expect(manifest.summary.instructional_reviewed_count).toBe(0);
    expect(manifest.summary.approved_count).toBe(0);
    expect(manifest.summary.assessment_eligible_count).toBe(0);

    const output = formatSummary(manifest.summary);
    expect(output).toContain('claims_in_slice: 13');
    expect(output).toContain('candidate_sources_discovered: 6');
    expect(output).toContain('mapped_count: 0');
    expect(output).toContain('assessment_eligible_count: 0');
  });

  test('records identity, locator, date, type and rights fields for every candidate', () => {
    expect(manifest.source_candidates.length).toBeGreaterThan(0);
    for (const source of manifest.source_candidates) {
      expect(source.canonical_url).toMatch(/^https:\/\//);
      expect(Array.isArray(source.section_or_page)).toBe(true);
      expect(source.section_or_page.length).toBeGreaterThan(0);
      expect(source.publication_or_revision_date).toBeTruthy();
      expect(source.source_type).toBeTruthy();
      expect(source.rights_classification_candidate).toBeTruthy();
      expect(source.rights_status).toBeTruthy();
      expect(source.evidence_decision).toBe('candidate-only');
      expect(source.store_verbatim_excerpt).toBe(false);
      expect(source.may_generate_questions).toBe(false);
      expect(source.approval_effect).toBe('none');
    }

    const unclearRights = manifest.source_candidates.filter((source) =>
      String(source.rights_status).includes('rights-review-required')
    );
    expect(unclearRights.length).toBeGreaterThan(0);
    for (const source of unclearRights) {
      expect(source.evidence_decision).toBe('candidate-only');
      expect(source.store_verbatim_excerpt).toBe(false);
    }
  });

  test('leaves the 200 preserved drafts and intake gates untouched', () => {
    expect(intake.summary.mapped_count).toBe(0);
    const chargingEntries = intake.entries.filter((entry) => entry.scenario_id === 'charging-system');
    expect(chargingEntries.length).toBe(9);

    const totalClaims = chargingEntries.reduce(
      (count, entry) => count + entry.claims_to_verify.length,
      0
    );
    expect(manifest.claim_candidates.length).toBe(totalClaims);

    for (const entry of chargingEntries) {
      expect(entry.mapping_status).toBe('unmapped-source-discovery-required');
      expect(entry.evidence_mapping_completed).toBe(false);
      expect(entry.candidate_sources).toEqual([]);
    }
    for (const row of manifest.claim_candidates) {
      expect(row.mapping_committed).toBe(false);
      expect(row.locator_verification === undefined || row.locator_verification === 'pending-human-review').toBe(true);
    }
  });

  test('keeps every claim-to-candidate reference resolvable and pending human review', () => {
    const candidateIds = manifest.source_candidates.map((source) => source.candidate_id);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);

    const claimIds = manifest.claim_candidates.map((row) => row.claim_id);
    expect(new Set(claimIds).size).toBe(claimIds.length);

    for (const row of manifest.claim_candidates) {
      expect(row.discovery_status).toBe('candidate-identified-pending-human-rights-and-technical-review');
      expect(row.candidates.length).toBeGreaterThan(0);
      for (const ref of row.candidates) {
        expect(candidateIds).toContain(ref.candidate_id);
        expect(ref.locator).toBeTruthy();
        expect(ref.locator_verification).toBe('pending-human-review');
      }
    }
  });
});
