const {validate,formatSummary}=require('../scripts/validate-charging-system-final-approval-prep');

describe('charging-system final content approval preparation',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('includes only the three fully reviewed claims',()=>{
    expect(prep.reviews.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-05',
      'charging-system-challenge-claim-07',
      'charging-system-challenge-claim-08'
    ]);
    expect(prep.summary.claims_eligible_for_final_content_approval).toBe(3);
  });

  test('carries accepted learner-facing text and scope forward',()=>{
    const byId=Object.fromEntries(prep.reviews.map(r=>[r.claim_id,r]));
    expect(byId['charging-system-challenge-claim-05'].final_content_text)
      .toBe('Lead-acid battery charging behavior depends on state of charge and the charger or regulator strategy.');
    expect(byId['charging-system-challenge-claim-07'].final_content_text)
      .toBe('Under constant-voltage charging, a discharged lead-acid battery may initially accept high current, and charging current decreases as battery voltage rises toward full charge.');
    expect(byId['charging-system-challenge-claim-08'].final_content_text)
      .toBe('Electrical charging demand and belt-driven auxiliaries increase mechanical load on the engine.');
  });

  test('keeps reviewer identity and final decisions empty',()=>{
    for(const row of prep.reviews){
      expect(row.reviewer_identity).toBeNull();
      expect(row.reviewed_at).toBeNull();
      expect(row.final_approval_status).toBe('pending-human-final-approval');
    }
    expect(prep.summary.human_final_decisions_recorded).toBe(0);
    expect(prep.summary.final_approved_count).toBe(0);
  });

  test('keeps assessment and scoring authority closed',()=>{
    for(const row of prep.reviews){
      expect(row.assessment_eligible).toBe(false);
      expect(row.not_allowed_by_this_gate).toContain('assessment eligibility');
      expect(row.not_allowed_by_this_gate).toContain('scoring or grading use');
      expect(row.not_allowed_by_this_gate).toContain('question-bank approval');
    }
    const out=formatSummary(prep.summary);
    expect(out).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked at citation validation',()=>{
    expect(prep.blocked_claims.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});