const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-assessment-eligibility-decision-prep');

describe('charging-system assessment-eligibility decision prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload assessment-eligibility preparation validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('prepares all three items for a separate human eligibility decision',()=>{
    expect(prep.summary.items_prepared_for_human_assessment_eligibility_decision).toBe(3);
    expect(prep.summary.items_with_complete_formative_governance).toBe(3);
    expect(prep.summary.items_with_approved_scoring_definition).toBe(3);
    for(const item of prep.items){
      const p=item.proposed_assessment_eligibility_decision;
      expect(p.status).toBe('prepared-awaiting-explicit-human-decision');
      expect(p.reviewer_identity).toBeNull();
      expect(p.reviewed_at).toBeNull();
      expect(p.recommended_decision).toBe('approve-for-low-stakes-governed-formative-assessment-only');
    }
  });

  test('keeps actual assessment eligibility and scored delivery closed',()=>{
    for(const item of prep.items){
      const p=item.proposed_assessment_eligibility_decision;
      expect(p.assessment_eligible).toBe(false);
      expect(p.scored_delivery_enabled).toBe(false);
    }
    expect(prep.summary.human_assessment_eligibility_decisions_recorded).toBe(0);
    expect(prep.summary.assessment_eligible_count).toBe(0);
    expect(prep.summary.scored_delivery_enabled_count).toBe(0);
  });

  test('limits any future approval to low-stakes governed formative use',()=>{
    for(const item of prep.items){
      const e=item.effect_if_later_approved_as_recommended;
      expect(e.assessment_eligible_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.scored_delivery_enabled).toBe(false);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
      expect(e.certification_eligible).toBe(false);
      expect(e.production_assessment_api_eligible).toBe(false);
      expect(e.assessment_release).toBe(false);
      expect(e.production_release).toBe(false);
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