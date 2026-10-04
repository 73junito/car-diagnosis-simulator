const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-human-review-decisions');

describe('charging-system formative human review decisions',()=>{
  const result=validate();
  const artifact=result.decisions;

  test('passes exact-payload governance validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('records all four human gates for all three items',()=>{
    expect(artifact.summary.items_reviewed).toBe(3);
    expect(artifact.summary.rights_decisions_recorded).toBe(3);
    expect(artifact.summary.technical_decisions_recorded).toBe(3);
    expect(artifact.summary.instructional_decisions_recorded).toBe(3);
    expect(artifact.summary.safety_decisions_recorded).toBe(3);
    expect(artifact.summary.human_item_level_reviews_complete_count).toBe(3);
  });

  test('binds each approval to the explicit reviewer and timestamp',()=>{
    for(const item of artifact.decisions){
      for(const gate of ['rights_confirmation','technical_review','instructional_review','safety_review']){
        expect(item[gate].decision).toBe('approved-as-recommended');
        expect(item[gate].reviewer_identity).toBe('Rafael Rodriguez Jr.');
        expect(item[gate].reviewed_at).toBe('2026-10-04T20:51:16Z');
      }
    }
  });

  test('keeps final item approval separate and pending',()=>{
    for(const item of artifact.decisions){
      expect(item.final_item_approval.decision).toBe('pending-separate-human-approval');
      expect(item.final_item_approval.reviewer_identity).toBeNull();
      expect(item.final_item_approval.reviewed_at).toBeNull();
      expect(item.governance_effect.final_item_approved).toBe(false);
    }
    expect(artifact.summary.final_item_approvals_recorded).toBe(0);
  });

  test('keeps scoring eligibility and release closed',()=>{
    for(const item of artifact.decisions){
      expect(item.governance_effect.scored).toBe(false);
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