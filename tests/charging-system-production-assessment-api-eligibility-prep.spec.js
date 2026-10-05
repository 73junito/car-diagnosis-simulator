const {validate}=require('../scripts/validate-charging-system-production-assessment-api-eligibility-prep');

describe('charging-system production assessment API eligibility prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload API readiness validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('keeps all three items API-ineligible pending runtime verification',()=>{
    expect(prep.summary.items_reviewed_for_production_assessment_api_readiness).toBe(3);
    expect(prep.summary.positive_api_eligibility_recommendations).toBe(0);
    expect(prep.summary.recommended_remain_api_ineligible_count).toBe(3);
    expect(prep.summary.production_assessment_api_eligible_count).toBe(0);
    for(const item of prep.items){
      expect(item.production_assessment_api_readiness.status).toBe('not-ready-for-positive-eligibility-decision');
      expect(item.production_assessment_api_readiness.production_assessment_api_eligible).toBe(false);
      expect(item.proposed_human_decision.reviewer_identity).toBeNull();
      expect(item.proposed_human_decision.reviewed_at).toBeNull();
    }
  });

  test('preserves low-stakes scored delivery while broader gates remain closed',()=>{
    for(const item of prep.items){
      const e=item.governance_effect_if_recommended_decision_is_approved;
      expect(e.scored_delivery_enabled_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.assessment_eligible_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.production_assessment_api_eligible).toBe(false);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
      expect(e.certification_eligible).toBe(false);
      expect(e.assessment_release).toBe(false);
      expect(e.production_release).toBe(false);
    }
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(prep.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});