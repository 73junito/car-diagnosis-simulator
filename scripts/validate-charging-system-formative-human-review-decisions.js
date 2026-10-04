'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionsPath=options.decisionsPath||path.join(root,'data','evidence','review-queues','charging-system-formative-human-review-decisions-20261004.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-human-review-prep-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const decisions=readJson(decisionsPath);
  const prep=readJson(prepPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(decisions.artifact_type!=='formative-item-human-review-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='item-level-human-reviews-complete-pending-final-item-approval') errors.push('stage mismatch');
  if(decisions.source_artifact_canonical_sha256!==prep.source_artifact_canonical_sha256) errors.push('prep hash mismatch');
  if(decisions.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const confirmation=decisions.human_confirmation||{};
  if(confirmation.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push('reviewer identity mismatch');
  if(confirmation.reviewed_at!=='2026-10-04T20:51:16Z') errors.push('reviewed_at mismatch');
  if(confirmation.user_confirmation!=='I approve the rights, technical, instructional, and safety review recommendations for charging-system formative items 05, 07, and 08 as written') errors.push('user confirmation mismatch');

  const prepBy=new Map(prep.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((decisions.decisions||[]).length!==3) errors.push('must contain exactly three item decisions');

  for(const item of decisions.decisions||[]){
    const p=prepBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!p||!q){errors.push(item.id+': missing prep/draft linkage');continue;}
    if(item.claim_id!==p.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==p.canonical_item_sha256) errors.push(item.id+': prep item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(p.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    for(const gate of ['rights_confirmation','technical_review','instructional_review','safety_review']){
      const g=item[gate]||{};
      const pg=p[gate]||{};
      if(g.decision!=='approved-as-recommended') errors.push(item.id+': '+gate+' decision mismatch');
      if(g.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(item.id+': '+gate+' reviewer mismatch');
      if(g.reviewed_at!=='2026-10-04T20:51:16Z') errors.push(item.id+': '+gate+' reviewed_at mismatch');
      if(g.approved_recommendation!==pg.recommendation) errors.push(item.id+': '+gate+' recommendation mismatch');
    }

    const f=item.final_item_approval||{};
    if(f.decision!=='pending-separate-human-approval') errors.push(item.id+': final item decision must remain pending');
    if(f.reviewer_identity!==null||f.reviewed_at!==null) errors.push(item.id+': final item reviewer/time must remain null');

    const e=item.governance_effect||{};
    if(e.human_item_level_reviews_complete!==true) errors.push(item.id+': human reviews should be complete');
    if(e.final_item_approved!==false) errors.push(item.id+': final item approval must remain false');
    for(const field of ['scored','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=decisions.summary||{};
  for(const field of ['items_reviewed','rights_decisions_recorded','technical_decisions_recorded','instructional_decisions_recorded','safety_decisions_recorded','human_item_level_reviews_complete_count']){
    if(s[field]!==3) errors.push('summary.'+field+' must be 3');
  }
  for(const field of ['final_item_approvals_recorded','scored_count','assessment_eligible_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(decisions.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,decisions};
}

function formatSummary(s){
  return [
    'items_reviewed: '+s.items_reviewed,
    'rights_decisions_recorded: '+s.rights_decisions_recorded,
    'technical_decisions_recorded: '+s.technical_decisions_recorded,
    'instructional_decisions_recorded: '+s.instructional_decisions_recorded,
    'safety_decisions_recorded: '+s.safety_decisions_recorded,
    'final_item_approvals_recorded: '+s.final_item_approvals_recorded,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.decisions.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system formative human-review decisions are exact-payload-bound and preserve downstream gates.');
}

module.exports={validate,formatSummary};