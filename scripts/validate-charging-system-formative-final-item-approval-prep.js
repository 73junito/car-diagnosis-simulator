'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-final-item-approval-prep-20261004.json');
  const decisionsPath=options.decisionsPath||path.join(root,'data','evidence','review-queues','charging-system-formative-human-review-decisions-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const prep=readJson(prepPath);
  const decisions=readJson(decisionsPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(prep.artifact_type!=='formative-final-item-approval-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='final-item-recommendations-awaiting-named-human-approval') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==decisions.source_artifact_canonical_sha256) errors.push('decision source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const decBy=new Map(decisions.decisions.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((prep.items||[]).length!==3) errors.push('must prepare exactly three items');

  for(const item of prep.items||[]){
    const d=decBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!d||!q){errors.push(item.id+': missing prerequisite linkage');continue;}
    if(item.claim_id!==d.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim linkage mismatch');
    if(item.canonical_item_sha256!==d.canonical_item_sha256) errors.push(item.id+': decision item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(d.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const p=item.prerequisite_status||{};
    for(const field of ['rights_review','technical_review','instructional_review','safety_review']){
      if(p[field]!=='approved') errors.push(item.id+': '+field+' must be approved');
    }
    if(p.deterministic_validation!=='valid') errors.push(item.id+': deterministic validation must be valid');

    const f=item.final_item_approval||{};
    if(f.status!=='pending-human-final-item-approval') errors.push(item.id+': final item status must remain pending');
    if(f.reviewer_identity!==null||f.reviewed_at!==null) errors.push(item.id+': final reviewer/time must remain null');
    if(f.recommended_disposition!=='approve-for-governed-formative-use') errors.push(item.id+': recommendation mismatch');

    const e=item.governance_effect||{};
    for(const field of ['final_item_approved','formative_use_approved','scored','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false before final decision');
    }
  }

  const s=prep.summary||{};
  for(const field of ['items_eligible_for_final_item_approval','final_item_approval_recommendations_prepared','recommended_approve_for_governed_formative_use']){
    if(s[field]!==3) errors.push('summary.'+field+' must be 3');
  }
  for(const field of ['human_final_item_decisions_recorded','final_item_approved_count','formative_use_approved_count','scored_count','assessment_eligible_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }
  const blocked=(prep.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'items_eligible_for_final_item_approval: '+s.items_eligible_for_final_item_approval,
    'final_item_approval_recommendations_prepared: '+s.final_item_approval_recommendations_prepared,
    'recommended_approve_for_governed_formative_use: '+s.recommended_approve_for_governed_formative_use,
    'human_final_item_decisions_recorded: '+s.human_final_item_decisions_recorded,
    'final_item_approved_count: '+s.final_item_approved_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system final item approval preparation is exact-payload-bound and preserves separate downstream gates.');
}

module.exports={validate,formatSummary};