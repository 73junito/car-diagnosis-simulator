const {validate,formatSummary}=require('../scripts/validate-charging-system-assessment-eligibility-prep');

describe('charging-system assessment-eligibility preparation',()=>{
  const result=validate();
  const prep=result.prep;

  test('passes fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('reviews only the three final-approved claims',()=>{
    expect(prep.reviews.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-05',
      'charging-system-challenge-claim-07',
      'charging-system-challenge-claim-08'
    ]);
    expect(prep.summary.final_approved_claims_reviewed_for_assessment_readiness).toBe(3);
  });

  test('recommends all three remain ineligible at claim level',()=>{
    for(const row of prep.reviews){
      expect(row.assessment_eligibility_recommendation).toBe('remain-ineligible-at-claim-level');
      expect(row.assessment_eligible).toBe(false);
      expect(row.scored).toBe(false);
      expect(row.institutional_assessment_eligible).toBe(false);
      expect(row.high_stakes_eligible).toBe(false);
      expect(row.production_assessment_api_eligible).toBe(false);
    }
    expect(prep.summary.recommended_remain_ineligible_at_claim_level).toBe(3);
  });

  test('permits only formative draft generation from approved claims',()=>{
    for(const row of prep.reviews){
      expect(row.formative_draft_generation_allowed).toBe(true);
      expect(row.release_state.training_content_release).toBe(true);
      expect(row.release_state.assessment_release).toBe(false);
      expect(row.release_state.high_stakes_release).toBe(false);
      expect(row.release_state.production_release).toBe(false);
    }
  });

  test('keeps human assessment decision and eligibility at zero',()=>{
    expect(prep.summary.human_assessment_decisions_recorded).toBe(0);
    expect(prep.summary.assessment_eligible_count).toBe(0);
    expect(prep.summary.scored_count).toBe(0);
    expect(prep.summary.institutional_assessment_eligible_count).toBe(0);
    expect(prep.summary.high_stakes_eligible_count).toBe(0);
    expect(prep.summary.production_assessment_api_eligible_count).toBe(0);
    expect(formatSummary(prep.summary)).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked at citation validation',()=>{
    expect(prep.blocked_claims.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});