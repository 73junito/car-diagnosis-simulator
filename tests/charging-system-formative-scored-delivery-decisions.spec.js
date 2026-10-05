const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-scored-delivery-decisions');

describe('charging-system scored-delivery decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload scored-delivery decision validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records scored-delivery approval for all three exact items',()=>{
    expect(artifact.summary.scored_delivery_decisions_recorded).toBe(3);
    expect(artifact.summary.scored_delivery_enabled_for_low_stakes_governed_formative_use_count).toBe(3);
    for(const item of artifact.items){
      expect(item.scored_delivery_decision.decision).toBe('enabled-for-low-stakes-governed-formative-assessment-only');
      expect(item.scored_delivery_decision.reviewer_identity).toBe('Rafael Rodriguez Jr.');
      expect(item.scored_delivery_decision.reviewed_at).toBe('2026-10-05T01:10:25Z');
    }
  });

  test('keeps broader assessment and release gates closed',()=>{
    for(const item of artifact.items){
      const e=item.governance_effect;
      expect(e.scored_delivery_enabled_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.assessment_eligible_for_low_stakes_governed_formative_use).toBe(true);
      expect(e.institutional_assessment_eligible).toBe(false);
      expect(e.high_stakes_eligible).toBe(false);
      expect(e.certification_eligible).toBe(false);
      expect(e.production_assessment_api_eligible).toBe(false);
      expect(e.assessment_release).toBe(false);
      expect(e.production_release).toBe(false);
    }
    expect(formatSummary(artifact.summary)).toContain('institutional_assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});