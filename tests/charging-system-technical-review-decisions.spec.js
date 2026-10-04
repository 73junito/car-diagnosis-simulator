const {validate,formatSummary}=require('../scripts/validate-charging-system-technical-review-decisions');

describe('charging-system human technical-review decisions',()=>{
  const result=validate();
  const d=result.decisions;

  test('passes fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records five named human decisions',()=>{
    expect(d.reviews).toHaveLength(5);
    for (const row of d.reviews) {
      expect(row.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(row.reviewed_at).toBe('2026-10-04T01:56:38Z');
    }
    expect(d.summary.human_technical_decisions_recorded).toBe(5);
    expect(d.summary.technical_reviewed_count).toBe(5);
  });

  test('records three caveat approvals and two revised approvals',()=>{
    expect(d.summary.approved_with_caveat).toBe(3);
    expect(d.summary.approved_with_revision).toBe(2);
    const c08=d.reviews.find((r)=>r.claim_id==='charging-system-challenge-claim-08');
    const c12=d.reviews.find((r)=>r.claim_id==='charging-system-challenge-claim-12');
    expect(c08.technical_decision).toBe('approved-with-revision');
    expect(c08.approved_claim_text).toBe('Electrical charging demand and belt-driven auxiliaries increase mechanical load on the engine.');
    expect(c12.technical_decision).toBe('approved-with-revision');
    expect(c12.approved_claim_text).toBe('If charging-system output is insufficient under the specified electrical load, system voltage may fall below the manufacturer-specified range.');
  });

  test('keeps all later gates closed',()=>{
    for (const row of d.reviews) {
      expect(row.citation_validation_status).toBe('pending');
      expect(row.instructional_review_status).toBe('pending');
      expect(row.approval_status).toBe('pending');
      expect(row.assessment_eligible).toBe(false);
    }
    expect(d.summary.citation_validated_count).toBe(0);
    expect(d.summary.instructional_reviewed_count).toBe(0);
    expect(d.summary.approved_count).toBe(0);
    expect(d.summary.assessment_eligible_count).toBe(0);
  });

  test('summary output exposes technical review but no downstream promotion',()=>{
    const out=formatSummary(d.summary);
    expect(out).toContain('technical_reviewed_count: 5');
    expect(out).toContain('citation_validated_count: 0');
    expect(out).toContain('assessment_eligible_count: 0');
  });
});
