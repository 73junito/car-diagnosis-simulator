const {validate,formatSummary}=require('../scripts/validate-charging-system-formative-question-drafts');

describe('charging-system formative question drafts',()=>{
  const result=validate();
  const pkg=result.draft;

  test('passes structural fail-closed validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('creates one exact draft per final-approved claim',()=>{
    expect(pkg.questions.map(q=>q.claim_id)).toEqual([
      'charging-system-challenge-claim-05',
      'charging-system-challenge-claim-07',
      'charging-system-challenge-claim-08'
    ]);
    expect(pkg.question_count).toBe(3);
  });

  test('contains complete four-choice formative item payloads',()=>{
    for(const q of pkg.questions){
      expect(q.stem.length).toBeGreaterThan(20);
      expect(Object.keys(q.choices)).toEqual(['A','B','C','D']);
      expect(['A','B','C','D']).toContain(q.answer);
      expect(q.explanation.length).toBeGreaterThan(40);
    }
  });

  test('keeps every item unscored and assessment-ineligible',()=>{
    for(const q of pkg.questions){
      expect(q.status).toBe('draft-pending-item-level-review');
      expect(q.deliveryMode).toBe('formative-draft');
      expect(q.scored).toBe(false);
      expect(q.assessmentEligible).toBe(false);
      expect(q.institutionalAssessmentEligible).toBe(false);
      expect(q.highStakesEligible).toBe(false);
      expect(q.productionAssessmentApiEligible).toBe(false);
      expect(q.productionRelease).toBe(false);
      expect(q.assessmentRelease).toBe(false);
      expect(q.autoApproval).toBe(false);
    }
  });

  test('keeps all item-level governance gates pending',()=>{
    for(const q of pkg.questions){
      expect(q.item_level_governance.rights_review).toBe('pending-item-level-confirmation');
      expect(q.item_level_governance.technical_review).toBe('pending');
      expect(q.item_level_governance.instructional_review).toBe('pending');
      expect(q.item_level_governance.safety_review).toBe('pending');
      expect(q.item_level_governance.deterministic_item_validation).toBe('pending');
      expect(q.item_level_governance.human_item_approval).toBe('pending');
    }
  });

  test('preserves zero downstream authority',()=>{
    expect(pkg.summary.human_item_approvals_recorded).toBe(0);
    expect(pkg.summary.scored_count).toBe(0);
    expect(pkg.summary.assessment_eligible_count).toBe(0);
    expect(pkg.summary.production_release_count).toBe(0);
    expect(formatSummary(pkg.summary)).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(pkg.blocked_claims.map(r=>r.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});