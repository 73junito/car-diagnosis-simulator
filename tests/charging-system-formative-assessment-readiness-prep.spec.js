const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-assessment-readiness-prep');

describe('charging-system formative assessment readiness prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload readiness validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('recognizes completed item-level formative governance',()=>{
    expect(prep.summary.final_formative_items_reviewed_for_assessment_readiness).toBe(3);
    expect(prep.summary.prepared_for_separate_human_assessment_eligibility_review).toBe(3);
    expect(prep.summary.satisfied_item_governance_prerequisite_count_per_item).toBe(7);
    for(const item of prep.items){
      expect(item.current_governance.deterministic_validation).toBe('complete-valid');
      expect(item.current_governance.rights_review).toBe('approved');
      expect(item.current_governance.technical_review).toBe('approved');
      expect(item.current_governance.instructional_review).toBe('approved');
      expect(item.current_governance.safety_review).toBe('approved');
      expect(item.current_governance.final_item_approval).toBe('approved-for-governed-formative-use');
      expect(item.current_governance.formative_use_approved).toBe(true);
    }
  });

  test('keeps assessment decision unrecorded',()=>{
    for(const item of prep.items){
      expect(item.assessment_readiness.status).toBe('prepared-for-separate-human-assessment-eligibility-review');
      expect(item.assessment_readiness.reviewer_identity).toBeNull();
      expect(item.assessment_readiness.reviewed_at).toBeNull();
      expect(item.assessment_readiness.recommendation).toBe('remain-assessment-ineligible-pending-separate-scoring-and-eligibility-governance');
    }
    expect(prep.summary.human_assessment_eligibility_decisions_recorded).toBe(0);
  });

  test('keeps scoring eligibility and release closed',()=>{
    for(const item of prep.items){
      expect(item.assessment_readiness.scored).toBe(false);
      expect(item.assessment_readiness.assessment_eligible).toBe(false);
      expect(item.assessment_readiness.institutional_assessment_eligible).toBe(false);
      expect(item.assessment_readiness.high_stakes_eligible).toBe(false);
      expect(item.assessment_readiness.production_assessment_api_eligible).toBe(false);
      expect(item.assessment_readiness.assessment_release).toBe(false);
      expect(item.assessment_readiness.production_release).toBe(false);
      expect(item.remaining_blockers_before_any_assessment_eligibility_decision).toHaveLength(2);
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