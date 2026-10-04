const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-scoring-definition-decisions');

describe('charging-system formative scoring-definition decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload scoring approval validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records human approval of all three scoring definitions',()=>{
    expect(artifact.summary.scoring_definitions_approved_count).toBe(3);
    for(const item of artifact.items){
      expect(item.scoring_definition_decision.decision).toBe('approved-as-written');
      expect(item.scoring_definition_decision.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(item.scoring_definition_decision.reviewed_at).toBe('2026-10-04T22:32:01Z');
      expect(item.scoring_definition_decision.approved_scoring_model.points_if_keyed_answer_selected).toBe(1);
      expect(item.scoring_definition_decision.approved_scoring_model.points_if_non_keyed_answer_selected).toBe(0);
    }
  });

  test('keeps scored delivery and assessment gates closed',()=>{
    for(const item of artifact.items){
      expect(item.governance_effect.scoring_definition_approved).toBe(true);
      expect(item.governance_effect.scored_delivery_enabled).toBe(false);
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