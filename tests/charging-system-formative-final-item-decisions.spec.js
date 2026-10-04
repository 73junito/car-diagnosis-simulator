const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-final-item-decisions');

describe('charging-system formative final item decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload final approval validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records final formative approval for all three exact items',()=>{
    expect(artifact.summary.items_finally_approved).toBe(3);
    expect(artifact.summary.formative_use_approved_count).toBe(3);
    for(const item of artifact.decisions){
      expect(item.final_item_approval.decision).toBe('approved-for-governed-formative-use');
      expect(item.final_item_approval.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(item.final_item_approval.reviewed_at).toBe('2026-10-04T21:13:22Z');
      expect(item.governance_effect.final_item_approved).toBe(true);
      expect(item.governance_effect.formative_use_approved).toBe(true);
    }
  });

  test('keeps scoring and assessment authority closed',()=>{
    for(const item of artifact.decisions){
      expect(item.governance_effect.scored).toBe(false);
      expect(item.governance_effect.assessment_eligible).toBe(false);
      expect(item.governance_effect.institutional_assessment_eligible).toBe(false);
      expect(item.governance_effect.high_stakes_eligible).toBe(false);
      expect(item.governance_effect.production_assessment_api_eligible).toBe(false);
      expect(item.governance_effect.assessment_release).toBe(false);
      expect(item.governance_effect.production_release).toBe(false);
    }
    expect(formatSummary(artifact.summary)).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});