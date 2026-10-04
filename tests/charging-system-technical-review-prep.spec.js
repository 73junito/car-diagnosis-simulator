const {
  validate,
  formatSummary
} = require('../scripts/validate-charging-system-technical-review-prep');

describe('charging-system technical-review preparation contract', () => {
  const result = validate();
  const prep = result.prep;

  test('passes fail-closed validation', () => {
    expect(result.errors).toEqual([]);
  });

  test('covers the five mapped claims with three support recommendations and two revisions', () => {
    expect(prep.reviews.map((r) => r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-05',
      'charging-system-challenge-claim-07',
      'charging-system-challenge-claim-08',
      'charging-system-challenge-claim-12'
    ]);
    expect(prep.summary.recommended_support_with_caveat).toBe(3);
    expect(prep.summary.recommended_revision_before_technical_approval).toBe(2);
  });

  test('keeps human reviewer identity and downstream gates closed', () => {
    for (const row of prep.reviews) {
      expect(row.review_status).toBe('pending-human-technical-review');
      expect(row.reviewer_identity).toBeNull();
      expect(row.reviewed_at).toBeNull();
      expect(row.citation_validation_status).toBe('pending');
      expect(row.instructional_review_status).toBe('pending');
      expect(row.approval_status).toBe('pending');
      expect(row.assessment_eligible).toBe(false);
    }
    expect(prep.summary.human_technical_decisions_recorded).toBe(0);
    expect(prep.summary.technical_reviewed_count).toBe(0);
    expect(prep.summary.citation_validated_count).toBe(0);
    expect(prep.summary.approved_count).toBe(0);
    expect(prep.summary.assessment_eligible_count).toBe(0);
  });

  test('requires revisions for claims 08 and 12', () => {
    for (const id of ['charging-system-challenge-claim-08','charging-system-challenge-claim-12']) {
      const row = prep.reviews.find((r) => r.claim_id === id);
      expect(row.recommended_disposition).toBe('revise-before-technical-approval');
      expect(row.required_revision).toBeTruthy();
    }
  });

  test('summary output exposes no technical approval', () => {
    const output = formatSummary(prep.summary);
    expect(output).toContain('human_technical_decisions_recorded: 0');
    expect(output).toContain('technical_reviewed_count: 0');
    expect(output).toContain('assessment_eligible_count: 0');
  });
});
