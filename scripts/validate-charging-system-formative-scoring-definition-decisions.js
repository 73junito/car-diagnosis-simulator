'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionsPath=options.decisionsPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scoring-definition-decisions-20261004.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scoring-definition-prep-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const decisions=readJson(decisionsPath);
  const prep=readJson(prepPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(decisions.artifact_type!=='formative-item-scoring-definition-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='scoring-definitions-approved-no-scored-delivery') errors.push('stage mismatch');
  if(decisions.source_artifact_canonical_sha256!==prep.source_artifact_canonical_sha256) errors.push('prep source hash mismatch');
  if(decisions.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const hc=decisions.human_confirmation||{};
  if(hc.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push('reviewer identity mismatch');
  if(hc.reviewed_at!=='2026-10-04T22:32:01Z') errors.push('reviewed_at mismatch');
  if(hc.user_confirmation!=='I approve the proposed 1-point / 0-point scoring definitions for charging-system formative items 05, 07, and 08 as written.') errors.push('user confirmation mismatch');

  const prepBy=new Map(prep.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((decisions.items||[]).length!==3) errors.push('must contain exactly three scoring decisions');

  for(const item of decisions.items||[]){
    const p=prepBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!p||!q){errors.push(item.id+': missing prep/draft linkage');continue;}
    if(item.claim_id!==p.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==p.canonical_item_sha256) errors.push(item.id+': prep item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(p.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const sd=item.scoring_definition_decision||{};
    if(sd.decision!=='approved-as-written') errors.push(item.id+': scoring decision mismatch');
    if(sd.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(item.id+': reviewer mismatch');
    if(sd.reviewed_at!=='2026-10-04T22:32:01Z') errors.push(item.id+': reviewed_at mismatch');
    if(JSON.stringify(sd.approved_scoring_model)!==JSON.stringify(p.scoring_definition.recommended_scoring_model)) errors.push(item.id+': scoring model mismatch');
    if(JSON.stringify(sd.approved_interpretation)!==JSON.stringify(p.scoring_definition.recommended_interpretation)) errors.push(item.id+': interpretation mismatch');

    const e=item.governance_effect||{};
    if(e.scoring_definition_approved!==true) errors.push(item.id+': scoring_definition_approved must be true');
    for(const field of ['scored_delivery_enabled','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=decisions.summary||{};
  if(s.scoring_definitions_approved_count!==3) errors.push('summary.scoring_definitions_approved_count must be 3');
  for(const field of ['scored_delivery_enabled_count','assessment_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(decisions.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,decisions};
}

function formatSummary(s){
  return [
    'scoring_definitions_approved_count: '+s.scoring_definitions_approved_count,
    'scored_delivery_enabled_count: '+s.scored_delivery_enabled_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.decisions.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system scoring-definition approvals are exact-payload-bound and do not enable scored delivery or assessment use.');
}

module.exports={validate,formatSummary};