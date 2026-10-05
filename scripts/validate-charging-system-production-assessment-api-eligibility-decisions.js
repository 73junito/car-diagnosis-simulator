'use strict';
const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionsPath=options.decisionsPath||path.join(root,'data','evidence','review-queues','charging-system-production-assessment-api-eligibility-decisions-20261005.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-production-assessment-api-eligibility-prep-20261005.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const decisions=readJson(decisionsPath), prep=readJson(prepPath), draft=readJson(draftPath);
  const errors=[];

  if(decisions.artifact_type!=='production-assessment-api-eligibility-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='production-assessment-api-ineligible-pending-runtime-verification') errors.push('stage mismatch');
  if(decisions.source_artifact_canonical_sha256!==prep.source_artifact_canonical_sha256) errors.push('prep source hash mismatch');
  if(decisions.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const hc=decisions.human_confirmation||{};
  if(hc.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push('reviewer identity mismatch');
  if(hc.reviewed_at!=='2026-10-05T01:30:49Z') errors.push('reviewed_at mismatch');
  if(hc.user_confirmation!=='I approve keeping charging-system formative items 05, 07, and 08 production-assessment-API-ineligible pending route-level contract and fail-closed verification, as written.') errors.push('user confirmation mismatch');

  const prepBy=new Map(prep.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((decisions.items||[]).length!==3) errors.push('must contain exactly three API eligibility decisions');

  for(const item of decisions.items||[]){
    const p=prepBy.get(item.id), q=draftBy.get(item.id);
    if(!p||!q){errors.push(item.id+': missing prep/draft linkage');continue;}
    if(item.claim_id!==p.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==p.canonical_item_sha256) errors.push(item.id+': prep item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(p.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const dec=item.production_assessment_api_decision||{};
    if(dec.decision!=='remain-production-assessment-api-ineligible-pending-runtime-contract-and-fail-closed-verification') errors.push(item.id+': decision mismatch');
    if(dec.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(item.id+': reviewer mismatch');
    if(dec.reviewed_at!=='2026-10-05T01:30:49Z') errors.push(item.id+': reviewed_at mismatch');

    const e=item.governance_effect||{};
    if(e.production_assessment_api_eligible!==false) errors.push(item.id+': API eligibility must remain false');
    if(e.scored_delivery_enabled_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': scored delivery must remain true');
    if(e.assessment_eligible_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': low-stakes assessment eligibility must remain true');
    for(const field of ['institutional_assessment_eligible','high_stakes_eligible','certification_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=decisions.summary||{};
  if(s.human_api_eligibility_decisions_recorded!==3) errors.push('summary human decisions count must be 3');
  if(s.remain_api_ineligible_decisions_count!==3) errors.push('summary remain-ineligible count must be 3');
  if(s.production_assessment_api_eligible_count!==0) errors.push('summary API eligible count must remain 0');
  if(s.items_with_low_stakes_scored_delivery_enabled!==3) errors.push('summary scored-delivery count must be 3');
  if(s.items_with_low_stakes_formative_assessment_eligibility!==3) errors.push('summary formative eligibility count must be 3');
  for(const field of ['institutional_assessment_eligible_count','high_stakes_eligible_count','certification_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(decisions.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,decisions};
}

if(require.main===module){
  const r=validate();
  console.log('human_api_eligibility_decisions_recorded: '+r.decisions.summary.human_api_eligibility_decisions_recorded);
  console.log('remain_api_ineligible_decisions_count: '+r.decisions.summary.remain_api_ineligible_decisions_count);
  console.log('production_assessment_api_eligible_count: '+r.decisions.summary.production_assessment_api_eligible_count);
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: explicit API-ineligibility decisions are exact-payload-bound and broader gates remain closed.');
}
module.exports={validate};