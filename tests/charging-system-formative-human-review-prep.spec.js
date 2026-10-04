const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-human-review-prep');

describe('charging-system formative human review prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('prepares all four human gates for three items',()=>{
    expect(prep.summary.items_prepared_for_human_review).toBe(3);
    expect(prep.summary.rights_confirmations_prepared).toBe(3);
    expect(prep.summary.technical_reviews_prepared).toBe(3);
    expect(prep.summary.instructional_reviews_prepared).toBe(3);
    expect(prep.summary.safety_reviews_prepared).toBe(3);
  });

  test('contains recommendations but no human decisions',()=>{
    for(const item of prep.items){
      for(const gate of ['rights_confirmation','technical_review','instructional_review','safety_review']){
        expect(item[gate].recommendation).toBeTruthy();
        expect(item[gate].reviewer).toBeNull();
        expect(item[gate].reviewed_at).toBeNull();
        expect(item[gate].human_decision).toBe('pending');
      }
      expect(item.final_item_approval.human_decision).toBe('pending');
      expect(item.final_item_approval.reviewer).toBeNull();
      expect(item.final_item_approval.reviewed_at).toBeNull();
    }
  });

  test('keeps scoring eligibility and release closed',()=>{
    for(const item of prep.items){
      expect(item.governance_effect.scored).toBe(false);
      expect(item.governance_effect.assessment_eligible).toBe(false);
      expect(item.governance_effect.institutional_assessment_eligible).toBe(false);
      expect(item.governance_effect.high_stakes_eligible).toBe(false);
      expect(item.governance_effect.production_assessment_api_eligible).toBe(false);
      expect(item.governance_effect.assessment_release).toBe(false);
      expect(item.governance_effect.production_release).toBe(false);
    }
    expect(prep.summary.assessment_eligible_count).toBe(0);
    expect(prep.summary.production_release_count).toBe(0);
  });

  test('does not record final item approvals',()=>{
    expect(prep.summary.human_final_item_approvals_recorded).toBe(0);
    expect(formatSummary(prep.summary)).toContain('human_final_item_approvals_recorded: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(prep.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});