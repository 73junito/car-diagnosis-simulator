const {validate,formatSummary,canonicalHash}=require('../scripts/validate-charging-system-formative-deterministic-validation');

describe('charging-system formative deterministic validation',()=>{
  const result=validate();
  const artifact=result.result;
  const source=result.source;

  test('passes exact-payload deterministic validation',()=>{
    expect(result.errors).toEqual([]);
  });

  test('validates all three exact items',()=>{
    expect(artifact.summary.questions_validated).toBe(3);
    expect(artifact.summary.questions_valid).toBe(3);
    expect(artifact.summary.questions_invalid).toBe(0);
    expect(artifact.items.map(i=>i.result)).toEqual(['valid','valid','valid']);
  });

  test('binds validation to the canonical source artifact and canonical item hashes',()=>{
    expect(artifact.source_artifact_canonical_sha256).toBe(canonicalHash(source));
    for(const item of artifact.items){
      const q=source.questions.find(x=>x.id===item.id);
      expect(item.canonical_item_sha256).toBe(canonicalHash(q));
    }
  });

  test('preserves exact answer keys and four unique choices',()=>{
    for(const q of source.questions){
      expect(Object.keys(q.choices)).toEqual(['A','B','C','D']);
      expect(new Set(Object.values(q.choices)).size).toBe(4);
      expect(Object.prototype.hasOwnProperty.call(q.choices,q.answer)).toBe(true);
    }
  });

  test('does not promote source item governance state',()=>{
    for(const q of source.questions){
      expect(q.status).toBe('draft-pending-item-level-review');
      expect(q.item_level_governance.deterministic_item_validation).toBe('pending');
      expect(q.item_level_governance.technical_review).toBe('pending');
      expect(q.item_level_governance.instructional_review).toBe('pending');
      expect(q.item_level_governance.safety_review).toBe('pending');
      expect(q.item_level_governance.human_item_approval).toBe('pending');
    }
  });

  test('keeps downstream authority at zero',()=>{
    expect(artifact.summary.human_item_approvals_recorded).toBe(0);
    expect(artifact.summary.scored_count).toBe(0);
    expect(artifact.summary.assessment_eligible_count).toBe(0);
    expect(artifact.summary.production_release_count).toBe(0);
    expect(artifact.post_validation_state.assessment_eligibility).toBe(false);
    expect(artifact.post_validation_state.scoring_authority).toBe(false);
    expect(artifact.post_validation_state.production_release).toBe(false);
    expect(formatSummary(artifact.summary)).toContain('assessment_eligible_count: 0');
  });

  test('keeps claims 02 and 12 blocked',()=>{
    expect(artifact.blocked_claims.map(x=>x.claim_id)).toEqual([
      'charging-system-challenge-claim-02',
      'charging-system-challenge-claim-12'
    ]);
  });
});
