const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-assessment-eligibility-prep-20261003.json');
  const finalPath=options.finalPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-decisions-20261003.json');
  const prep=readJson(prepPath);
  const final=readJson(finalPath);
  const errors=[];

  if(prep.artifact_type!=='assessment-eligibility-review-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='assessment-eligibility-review-prepared-no-eligibility-change') errors.push('stage mismatch');

  const finalBy=new Map(final.decisions.map(r=>[r.claim_id,r]));
  const rows=prep.reviews||[];
  if(rows.length!==3) errors.push('must prepare exactly three assessment-readiness reviews');
  if(new Set(rows.map(r=>r.claim_id)).size!==rows.length) errors.push('duplicate claim_id');

  for(const row of rows){
    const f=finalBy.get(row.claim_id);
    if(!f){errors.push(row.claim_id+': missing final approval');continue;}
    if(row.final_content_text!==f.final_content_text) errors.push(row.claim_id+': final content mismatch');
    if(row.final_content_status!=='approved-for-governed-instructional-content') errors.push(row.claim_id+': final content status mismatch');
    if(row.assessment_review_status!=='prepared-pending-human-assessment-governance') errors.push(row.claim_id+': review status mismatch');
    if(row.reviewer_identity!==null) errors.push(row.claim_id+': reviewer_identity must remain null');
    if(row.reviewed_at!==null) errors.push(row.claim_id+': reviewed_at must remain null');
    if(row.assessment_eligibility_recommendation!=='remain-ineligible-at-claim-level') errors.push(row.claim_id+': recommendation must remain ineligible at claim level');
    if(row.assessment_eligible!==false) errors.push(row.claim_id+': assessment_eligible must remain false');
    if(row.formative_draft_generation_allowed!==true) errors.push(row.claim_id+': formative draft generation should be allowed');
    for(const field of ['scored','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible']){
      if(row[field]!==false) errors.push(row.claim_id+': '+field+' must remain false');
    }
    const release=row.release_state||{};
    if(release.training_content_release!==true) errors.push(row.claim_id+': training content release must remain true');
    for(const field of ['assessment_release','high_stakes_release','production_release']){
      if(release[field]!==false) errors.push(row.claim_id+': release_state.'+field+' must remain false');
    }
    if(!Array.isArray(row.eligibility_blockers)||row.eligibility_blockers.length<5) errors.push(row.claim_id+': required eligibility blockers missing');
    const req=row['requirements_before_any_future_assessment-eligibility-decision'];
    if(!Array.isArray(req)||req.length<5) errors.push(row.claim_id+': future assessment requirements missing');
  }

  const expected=['charging-system-challenge-claim-05','charging-system-challenge-claim-07','charging-system-challenge-claim-08'];
  for(const id of expected) if(!rows.some(r=>r.claim_id===id)) errors.push('missing final-approved claim '+id);

  const blocked=(prep.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must be 02 and 12');

  const s=prep.summary;
  if(s.final_approved_claims_reviewed_for_assessment_readiness!==3) errors.push('reviewed count must be 3');
  if(s.recommended_remain_ineligible_at_claim_level!==3) errors.push('remain-ineligible recommendation count must be 3');
  for(const field of ['human_assessment_decisions_recorded','assessment_eligible_count','scored_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  return {errors,prep};
}

function formatSummary(s){
  return [
    'final_approved_claims_reviewed_for_assessment_readiness: '+s.final_approved_claims_reviewed_for_assessment_readiness,
    'recommended_remain_ineligible_at_claim_level: '+s.recommended_remain_ineligible_at_claim_level,
    'human_assessment_decisions_recorded: '+s.human_assessment_decisions_recorded,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'scored_count: '+s.scored_count,
    'institutional_assessment_eligible_count: '+s.institutional_assessment_eligible_count,
    'high_stakes_eligible_count: '+s.high_stakes_eligible_count,
    'production_assessment_api_eligible_count: '+s.production_assessment_api_eligible_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system assessment-eligibility preparation remains fail-closed.');
}
module.exports={validate,formatSummary};