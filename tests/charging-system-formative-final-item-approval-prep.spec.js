const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-final-item-approval-prep');

describe('charging-system formative final item approval prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload governance validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('prepares three final item approval recommendations',()=>{
    expect(prep.summary.items_eligible_for_final_item_approval).toBe(3);
    expect(prep.summary.final_item_approval_recommendations_prepared).toBe(3);
    expect(prep.summary.recommended_approve_for_governed_formative_use).toBe(3);
  });

  test('requires completed prerequisite reviews',()=>{
    for(const item of prep.items){
      expect(item.prerequisite_status.deterministic_validation).toBe('valid');
      expect(item.prerequisite_status.rights_review).toBe('approved');
      expect(item.prerequisite_status.technical_review).toBe('approved');
      expect(item.prerequisite_status.instructional_review).toBe('approved');
      expect(item.prerequisite_status.safety_review).toBe('approved');
    }
  });

  test('records recommendations but no final human decisions',()=>{
    for(const item of prep.items){
      expect(item.final_item_approval.status).toBe('pending-human-final-item-approval');
      expect(item.final_item_approval.reviewer_identity).toBeNull();
      expect(item.final_item_approval.reviewed_at).toBeNull();
      expect(item.final_item_approval.recommended_disposition).toBe('approve-for-governed-formative-use');
      expect(item.governance_effect.final_item_approved).toBe(false);
      expect(item.governance_effect.formative_use_approved).toBe(false);
    }
    expect(prep.summary.human_final_item_decisions_recorded).toBe(0);
    expect(prep.summary.final_item_approved_count).toBe(0);
  });

  test('keeps scoring assessment eligibility and release closed',()=>{
    for(const item of prep.items){
      expect(item.governance_effect.scored).toBe(false);
      expect(item.governance_effect.assessment_eligible).toBe(false);
      expect(item.governance_effect.institutional_assessment_eligible).toBe(false);
      expect(item.governance_effect.high_stakes_eligible).toBe(false);
      expect(item.governance_effect.production_assessment_api_eligible).toBe(false);
      expect(item.governance_effect.assessment_release).toBe(false);
      expect(item.governance_effect.production_release).toBe(false);
    }
    expect(formatSummary(prep.summary)).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(prep.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});