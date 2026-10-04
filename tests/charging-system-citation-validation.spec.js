const {validate,formatSummary}=require('../scripts/validate-charging-system-citation-validation');

describe('charging-system citation validation',()=>{
 const result=validate();
 const artifact=result.artifact;

 test('passes fail-closed validation',()=>{
  expect(result.errors).toEqual([]);
 });

 test('validates only claims with independently verified primary support',()=>{
  const valid=artifact.validations.filter(r=>r.citation_validation_status==='validated').map(r=>r.claim_id);
  expect(valid).toEqual([
   'charging-system-challenge-claim-05',
   'charging-system-challenge-claim-07',
   'charging-system-challenge-claim-08'
  ]);
  expect(artifact.summary.citation_validated_count).toBe(3);
 });

 test('keeps Navy-dependent claims pending',()=>{
  const pending=artifact.validations.filter(r=>r.citation_validation_status==='pending-artifact-verification').map(r=>r.claim_id);
  expect(pending).toEqual([
   'charging-system-challenge-claim-02',
   'charging-system-challenge-claim-12'
  ]);
  for(const row of artifact.validations.filter(r=>pending.includes(r.claim_id))){
    expect(row.sources.some(s=>s.support_status==='required-support-pending-verification')).toBe(true);
  }
  expect(artifact.summary.citation_pending_count).toBe(2);
 });

 test('uses technically approved revised wording downstream',()=>{
  const c08=artifact.validations.find(r=>r.claim_id==='charging-system-challenge-claim-08');
  const c12=artifact.validations.find(r=>r.claim_id==='charging-system-challenge-claim-12');
  expect(c08.approved_claim_text).toBe('Electrical charging demand and belt-driven auxiliaries increase mechanical load on the engine.');
  expect(c12.approved_claim_text).toBe('If charging-system output is insufficient under the specified electrical load, system voltage may fall below the manufacturer-specified range.');
 });

 test('keeps later gates closed',()=>{
  expect(artifact.summary.instructional_reviewed_count).toBe(0);
  expect(artifact.summary.approved_count).toBe(0);
  expect(artifact.summary.assessment_eligible_count).toBe(0);
  const out=formatSummary(artifact.summary);
  expect(out).toContain('citation_validated_count: 3');
  expect(out).toContain('assessment_eligible_count: 0');
 });
});