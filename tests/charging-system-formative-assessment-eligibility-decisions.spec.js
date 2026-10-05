const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-assessment-eligibility-decisions');

describe('charging-system assessment-eligibility decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload assessment-eligibility decision validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records low-stakes eligibility approval for all three exact items',()=>{
    expect(artifact.summary.assessment_eligibility_decisions_recorded).toBe(3);
    expect(artifact.summary.low_stakes_governed_formative_assessment_eligible_count).toBe(3);
    for(const item of artifact.items){
      expect(item.assessment_eligibility_decision.decision).toBe('approved-for-low-stakes-governed-formative-assessment-only');
      expect(item.assessment_eligibility_decision.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(item.assessment_eligibility_decision.reviewed_at).toBe('2026-10-05T00:48:42Z');
    }
  });

  test('keeps scored delivery and broader assessment gates closed',()=>{
    for(const item of artifact.items){
      const e=item.governance_effect;
      expect(e.assessment_eligible_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.scored_delivery_enabled).toBe(false);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
      expect(e.certification_eligible).toBe(false);
      expect(e.production_assessment_api_eligible).toBe(false);
      expect(e.assessment_release).toBe(false);
      expect(e.production_release).toBe(false);
    }
    expect(formatSummary(artifact.summary)).toContain('scored_delivery_enabled_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});