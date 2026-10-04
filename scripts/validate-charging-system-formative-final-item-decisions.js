'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionsPath=options.decisionsPath||path.join(root,'data','evidence','review-queues','charging-system-formative-final-item-decisions-20261004.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-final-item-approval-prep-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const decisions=readJson(decisionsPath);
  const prep=readJson(prepPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(decisions.artifact_type!=='formative-final-item-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='final-items-approved-for-governed-formative-use-only') errors.push('stage mismatch');
  if(decisions.source_artifact_canonical_sha256!==prep.source_artifact_canonical_sha256) errors.push('prep source hash mismatch');
  if(decisions.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const hc=decisions.human_confirmation||{};
  if(hc.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push('reviewer identity mismatch');
  if(hc.reviewed_at!=='2026-10-04T21:13:22Z') errors.push('reviewed_at mismatch');
  if(hc.user_confirmation!=='I approve the final item recommendations for charging-system formative items 05, 07, and 08 for governed formative use as written') errors.push('user confirmation mismatch');

  const prepBy=new Map(prep.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((decisions.decisions||[]).length!==3) errors.push('must contain exactly three final item decisions');

  for(const item of decisions.decisions||[]){
    const p=prepBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!p||!q){errors.push(item.id+': missing prep/draft linkage');continue;}
    if(item.claim_id!==p.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==p.canonical_item_sha256) errors.push(item.id+': prep item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(p.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const f=item.final_item_approval||{};
    if(f.decision!=='approved-for-governed-formative-use') errors.push(item.id+': final decision mismatch');
    if(f.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(item.id+': reviewer mismatch');
    if(f.reviewed_at!=='2026-10-04T21:13:22Z') errors.push(item.id+': reviewed_at mismatch');
    if(f.approved_recommendation!=='approve-for-governed-formative-use') errors.push(item.id+': approved recommendation mismatch');

    const e=item.governance_effect||{};
    if(e.final_item_approved!==true) errors.push(item.id+': final_item_approved must be true');
    if(e.formative_use_approved!==true) errors.push(item.id+': formative_use_approved must be true');
    for(const field of ['scored','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=decisions.summary||{};
  if(s.items_finally_approved!==3) errors.push('summary.items_finally_approved must be 3');
  if(s.formative_use_approved_count!==3) errors.push('summary.formative_use_approved_count must be 3');
  for(const field of ['scored_count','assessment_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(decisions.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,decisions};
}

function formatSummary(s){
  return [
    'items_finally_approved: '+s.items_finally_approved,
    'formative_use_approved_count: '+s.formative_use_approved_count,
    'scored_count: '+s.scored_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.decisions.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system final item decisions are exact-payload-bound and formative-only.');
}

module.exports={validate,formatSummary};