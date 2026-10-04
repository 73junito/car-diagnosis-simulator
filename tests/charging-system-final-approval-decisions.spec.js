const {validate,formatSummary}=require('../scripts/validate-charging-system-final-approval-decisions');

describe('charging-system human final content approval decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records three named human final approvals',()=>{
    expect(artifact.decisions).toHaveLength(3);
    for(const row of artifact.decisions){
      expect(row.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(row.reviewed_at).toBe('2026-10-04T03:16:40Z');
      expect(row.final_decision).toBe('approved-for-governed-instructional-content');
    }
    expect(artifact.summary.final_approved_count).toBe(3);
  });

  test('preserves approved learner-facing wording',()=>{
    const byId=Object.fromEntries(artifact.decisions.map(r=>[r.claim_id,r]));
    expect(byId['charging-system-challenge-claim-05'].final_content_text)
      .toBe('Lead-acid battery charging behavior depends on state of charge and the charger or regulator strategy.');
    expect(byId['charging-system-challenge-claim-07'].final_content_text)
      .toBe('Under constant-voltage charging, a discharged lead-acid battery may initially accept high current, and charging current decreases as battery voltage rises toward full charge.');
    expect(byId['charging-system-challenge-claim-08'].final_content_text)
      .toBe('Electrical charging demand and belt-driven auxiliaries increase mechanical load on the engine.');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });

  test('keeps assessment authority closed',()=>{
    for(const row of artifact.decisions){
      expect(row.assessment_eligible).toBe(false);
      expect(row.prohibited_by_this_decision).toContain('assessment eligibility');
      expect(row.prohibited_by_this_decision).toContain('scoring or grading use');
      expect(row.prohibited_by_this_decision).toContain('question-bank approval');
    }
    const out=formatSummary(artifact.summary);
    expect(out).toContain('final_approved_count: 3');
    expect(out).toContain('assessment_eligible_count: 0');
  });
});