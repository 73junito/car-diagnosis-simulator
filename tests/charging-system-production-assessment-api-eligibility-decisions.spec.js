const {validate}=require('../scripts/validate-charging-system-production-assessment-api-eligibility-decisions');

describe('charging-system production assessment API eligibility decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload API eligibility decision validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records three explicit remain-ineligible decisions',()=>{
    expect(artifact.summary.human_api_eligibility_decisions_recorded).toBe(3);
    expect(artifact.summary.remain_api_ineligible_decisions_count).toBe(3);
    expect(artifact.summary.production_assessment_api_eligible_count).toBe(0);
    for(const item of artifact.items){
      expect(item.production_assessment_api_decision.decision).toBe('remain-production-assessment-api-ineligible-pending-runtime-contract-and-fail-closed-verification');
      expect(item.production_assessment_api_decision.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(item.production_assessment_api_decision.reviewed_at).toBe('2026-10-05T01:30:49Z');
    }
  });

  test('preserves low-stakes scored delivery while keeping broader gates closed',()=>{
    for(const item of artifact.items){
      const e=item.governance_effect;
      expect(e.production_assessment_api_eligible).toBe(false);
      expect(e.scored_delivery_enabled_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.assessment_eligible_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
      expect(e.certification_eligible).toBe(false);
      expect(e.assessment_release).toBe(false);
      expect(e.production_release).toBe(false);
    }
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});