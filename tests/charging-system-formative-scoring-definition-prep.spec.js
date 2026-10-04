const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-scoring-definition-prep');

describe('charging-system formative scoring definition prep',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes exact-payload scoring-prep validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('prepares binary one-point scoring for all three exact items',()=>{
    expect(prep.summary.items_with_scoring_definitions_prepared).toBe(3);
    expect(prep.summary.recommended_one_point_binary_scoring).toBe(3);
    for(const item of prep.items){
      const m=item.scoring_definition.recommended_scoring_model;
      expect(m.points_if_keyed_answer_selected).toBe(1);
      expect(m.points_if_non_keyed_answer_selected).toBe(0);
      expect(m.partial_credit).toBe(false);
      expect(m.negative_marking).toBe(false);
      expect(m.item_weight).toBe(1);
    }
  });

  test('records no human scoring decision yet',()=>{
    for(const item of prep.items){
      expect(item.scoring_definition.status).toBe('proposed-awaiting-explicit-human-approval');
      expect(item.scoring_definition.reviewer_identity).toBeNull();
      expect(item.scoring_definition.reviewed_at).toBeNull();
    }
    expect(prep.summary.human_scoring_definition_decisions_recorded).toBe(0);
    expect(prep.summary.scoring_definitions_approved_count).toBe(0);
  });

  test('keeps scored delivery and assessment gates closed',()=>{
    for(const item of prep.items){
      const e=item.approval_effect_if_later_confirmed;
      expect(e.scoring_definition_approved).toBe(true);
      expect(e.scored_delivery_enabled).toBe(false);
      expect(e.assessment_eligible).toBe(false);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
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