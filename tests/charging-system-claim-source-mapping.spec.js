const {
  validateChargingSystemClaimSourceMapping,
  formatSummary
} = require('../scripts/validate-charging-system-claim-source-mapping');

describe('charging-system claim-to-source mapping contract', () => {
  const result = validateChargingSystemClaimSourceMapping();
  const mapping = result.mapping;

  test('passes the fail-closed mapping validator', () => {
    expect(result.errors).toEqual([]);
  });

  test('maps only the bounded first slice and leaves unresolved claims unmapped', () => {
    const mappedIds = mapping.mappings
      .filter((row) => row.mapping_status === 'mapped-pending-technical-review')
      .map((row) => row.claim_id);
    expect(mappedIds).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-05',
      'charging-system-challenge-claim-07',
      'charging-system-challenge-claim-08',
      'charging-system-challenge-claim-12'
    ]);

    const claim13 = mapping.mappings.find((row) =>
      row.claim_id === 'charging-system-challenge-claim-13');
    expect(claim13.mapping_status).toMatch(/^unmapped-/);
    expect(claim13.mapped_sources).toEqual([]);
    expect(claim13.mapping_notes).toContain('13.5 V at idle alone');
  });

  test('preserves rights scope while keeping every downstream gate closed', () => {
    const claim08 = mapping.mappings.find((row) =>
      row.claim_id === 'charging-system-challenge-claim-08');
    expect(claim08.mapped_sources.map((s) => [s.candidate_id, s.rights_decision])).toEqual([
      ['frontiers-automotive-alternator-2023', 'cleared-commercial-reuse'],
      ['army-da-pam-750-33-1976', 'cleared-text-excerpt']
    ]);
    for (const row of mapping.mappings) {
      expect(row.technical_review_status).toBe('pending');
      expect(row.citation_validation_status).toBe('pending');
      expect(row.instructional_review_status).toBe('pending');
      expect(row.approval_status).toBe('pending');
      expect(row.assessment_eligible).toBe(false);
    }
  });

  test('summary reports mapping only, with no review or eligibility promotion', () => {
    expect(mapping.summary).toMatchObject({
      claims_in_slice: 13,
      mapped_count: 5,
      unmapped_count: 8,
      citation_validated_count: 0,
      technical_reviewed_count: 0,
      instructional_reviewed_count: 0,
      approved_count: 0,
      assessment_eligible_count: 0
    });
    const output = formatSummary(mapping.summary);
    expect(output).toContain('mapped_count: 5');
    expect(output).toContain('technical_reviewed_count: 0');
    expect(output).toContain('assessment_eligible_count: 0');
  });
});
