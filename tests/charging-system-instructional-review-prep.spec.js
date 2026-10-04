const {validate,formatSummary}=require('../scripts/validate-charging-system-instructional-review-prep');

describe('charging-system instructional-review preparation',()=>{
 const result=validate();
 const prep=result.prep;

 test('passes fail-closed validation',()=>{
  expect(result.errors).toEqual([]);
 });

 test('includes only the three citation-validated claims',()=>{
  expect(prep.reviews.map(r=>r.claim_id)).toEqual([
    'charging-system-challenge-claim-05',
    'charging-system-challenge-claim-07',
    'charging-system-challenge-claim-08'
  ]);
  expect(prep.summary.instructional_reviews_prepared).toBe(3);
 });

 test('recommends clarification for 05 and 07 and retains 08',()=>{
  const byId=Object.fromEntries(prep.reviews.map(r=>[r.claim_id,r]));
  expect(byId['charging-system-challenge-claim-05'].recommended_disposition).toBe('revise-for-instructional-clarity');
  expect(byId['charging-system-challenge-claim-07'].recommended_disposition).toBe('revise-for-instructional-clarity');
  expect(byId['charging-system-challenge-claim-08'].recommended_disposition).toBe('retain-with-instructional-scope');
 });

 test('keeps claims 02 and 12 blocked at citation validation',()=>{
  expect(prep.blocked_claims.map(r=>r.claim_id)).toEqual([
    'charging-system-challenge-claim-02',
    'charging-system-challenge-claim-12'
  ]);
 });

 test('records no human instructional decision or downstream promotion',()=>{
  for(const row of prep.reviews){
    expect(row.reviewer_identity).toBeNull();
    expect(row.reviewed_at).toBeNull();
    expect(row.final_approval_status).toBe('pending');
    expect(row.assessment_eligible).toBe(false);
  }
  const out=formatSummary(prep.summary);
  expect(out).toContain('human_instructional_decisions_recorded: 0');
  expect(out).toContain('instructional_reviewed_count: 0');
  expect(out).toContain('approved_count: 0');
  expect(out).toContain('assessment_eligible_count: 0');
 });
});