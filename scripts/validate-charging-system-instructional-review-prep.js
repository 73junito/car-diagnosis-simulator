const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-instructional-review-prep-20261003.json');
  const citationPath=options.citationPath||path.join(root,'data','evidence','review-queues','charging-system-citation-validation-20261003.json');
  const prep=readJson(prepPath);
  const citation=readJson(citationPath);
  const errors=[];

  if(prep.artifact_type!=='instructional-review-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='instructional-recommendations-awaiting-named-human-review') errors.push('stage mismatch');

  const eligible=citation.validations.filter(r=>r.citation_validation_status==='validated').map(r=>r.claim_id);
  const reviewIds=(prep.reviews||[]).map(r=>r.claim_id);
  if(reviewIds.length!==eligible.length) errors.push('prep must cover each citation-validated claim exactly once');
  if(new Set(reviewIds).size!==reviewIds.length) errors.push('duplicate claim_id');
  for(const id of eligible) if(!reviewIds.includes(id)) errors.push('missing eligible claim '+id);

  let revise=0,retain=0;
  for(const row of prep.reviews||[]){
    if(!eligible.includes(row.claim_id)) errors.push(row.claim_id+': claim is not citation-validated');
    const cited=citation.validations.find(r=>r.claim_id===row.claim_id);
    if(row.current_approved_claim_text!==cited.approved_claim_text) errors.push(row.claim_id+': source wording mismatch');
    if(row.instructional_review_status!=='pending-human-instructional-review') errors.push(row.claim_id+': review_status must remain pending');
    if(row.reviewer_identity!==null) errors.push(row.claim_id+': reviewer_identity must remain null');
    if(row.reviewed_at!==null) errors.push(row.claim_id+': reviewed_at must remain null');
    if(row.citation_status!=='validated') errors.push(row.claim_id+': citation_status must be validated');
    if(row.technical_status!=='reviewed') errors.push(row.claim_id+': technical_status must be reviewed');
    if(row.final_approval_status!=='pending') errors.push(row.claim_id+': final approval must remain pending');
    if(row.assessment_eligible!==false) errors.push(row.claim_id+': assessment eligibility must remain false');
    if(!row.recommended_instructional_text||!row.instructional_scope) errors.push(row.claim_id+': instructional text/scope required');
    if(row.recommended_disposition==='revise-for-instructional-clarity') revise++;
    else if(row.recommended_disposition==='retain-with-instructional-scope') retain++;
    else errors.push(row.claim_id+': invalid recommended disposition');
  }

  const blockedIds=(prep.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blockedIds)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must be 02 and 12');
  for(const row of prep.blocked_claims||[]){
    if(row.blocked_at!=='citation-validation') errors.push(row.claim_id+': blocked_at must be citation-validation');
  }

  const c05=prep.reviews.find(r=>r.claim_id==='charging-system-challenge-claim-05');
  const c07=prep.reviews.find(r=>r.claim_id==='charging-system-challenge-claim-07');
  const c08=prep.reviews.find(r=>r.claim_id==='charging-system-challenge-claim-08');
  if(!c05||c05.recommended_disposition!=='revise-for-instructional-clarity') errors.push('claim-05 must be revision recommendation');
  if(!c07||c07.recommended_disposition!=='revise-for-instructional-clarity') errors.push('claim-07 must be revision recommendation');
  if(!c08||c08.recommended_disposition!=='retain-with-instructional-scope') errors.push('claim-08 must be retain recommendation');

  const s=prep.summary;
  if(s.citation_validated_claims_eligible_for_instructional_review!==3) errors.push('eligible summary must be 3');
  if(s.instructional_reviews_prepared!==3) errors.push('prepared summary must be 3');
  if(s.recommended_revise_for_instructional_clarity!==revise) errors.push('revise summary mismatch');
  if(s.recommended_retain_with_instructional_scope!==retain) errors.push('retain summary mismatch');
  for(const field of ['human_instructional_decisions_recorded','instructional_reviewed_count','approved_count','assessment_eligible_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }
  return {errors,prep};
}

function formatSummary(s){
  return [
    'citation_validated_claims_eligible_for_instructional_review: '+s.citation_validated_claims_eligible_for_instructional_review,
    'instructional_reviews_prepared: '+s.instructional_reviews_prepared,
    'recommended_revise_for_instructional_clarity: '+s.recommended_revise_for_instructional_clarity,
    'recommended_retain_with_instructional_scope: '+s.recommended_retain_with_instructional_scope,
    'human_instructional_decisions_recorded: '+s.human_instructional_decisions_recorded,
    'instructional_reviewed_count: '+s.instructional_reviewed_count,
    'approved_count: '+s.approved_count,
    'assessment_eligible_count: '+s.assessment_eligible_count
  ].join('\n');
}

if(require.main===module){
 const r=validate();
 console.log(formatSummary(r.prep.summary));
 if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
 else console.log('PASS: charging-system instructional-review preparation remains fail-closed.');
}
module.exports={validate,formatSummary};