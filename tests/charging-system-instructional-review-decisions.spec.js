const {validate,formatSummary}=require('../scripts/validate-charging-system-instructional-review-decisions');

describe('charging-system human instructional-review decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records three named human instructional decisions',()=>{
    expect(artifact.decisions).toHaveLength(3);
    for(const row of artifact.decisions){
      expect(row.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(row.reviewed_at).toBe('2026-10-04T02:51:53Z');
    }
    expect(artifact.summary.instructional_reviewed_count).toBe(3);
  });

  test('records revisions for 05 and 07 and retains 08 with scope',()=>{
    const byId=Object.fromEntries(artifact.decisions.map(r=>[r.claim_id,r]));
    expect(byId['charging-system-challenge-claim-05'].instructional_decision).toBe('approved-with-instructional-revision');
    expect(byId['charging-system-challenge-claim-07'].instructional_decision).toBe('approved-with-instructional-revision');
    expect(byId['charging-system-challenge-claim-08'].instructional_decision).toBe('approved-as-written-with-instructional-scope');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });

  test('keeps final approval and assessment eligibility closed',()=>{
    for(const row of artifact.decisions){
      expect(row.final_approval_status).toBe('pending');
      expect(row.assessment_eligible).toBe(false);
    }
    const out=formatSummary(artifact.summary);
    expect(out).toContain('final_approved_count: 0');
    expect(out).toContain('assessment_eligible_count: 0');
  });
});