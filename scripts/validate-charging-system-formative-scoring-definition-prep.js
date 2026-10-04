'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scoring-definition-prep-20261004.json');
  const readinessPath=options.readinessPath||path.join(root,'data','evidence','review-queues','charging-system-formative-assessment-readiness-prep-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const prep=readJson(prepPath);
  const readiness=readJson(readinessPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(prep.artifact_type!=='formative-item-scoring-definition-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='scoring-definition-prepared-no-scoring-authority') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==readiness.source_artifact_canonical_sha256) errors.push('readiness source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const readyBy=new Map(readiness.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((prep.items||[]).length!==3) errors.push('must prepare exactly three item scoring definitions');

  for(const item of prep.items||[]){
    const r=readyBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!r||!q){errors.push(item.id+': missing readiness/draft linkage');continue;}
    if(item.claim_id!==r.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==r.canonical_item_sha256) errors.push(item.id+': readiness item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(r.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const s=item.scoring_definition||{};
    if(s.status!=='proposed-awaiting-explicit-human-approval') errors.push(item.id+': scoring status mismatch');
    if(s.reviewer_identity!==null||s.reviewed_at!==null) errors.push(item.id+': reviewer/time must remain null');
    const m=s.recommended_scoring_model||{};
    if(m.points_if_keyed_answer_selected!==1) errors.push(item.id+': keyed answer must be 1 point');
    if(m.points_if_non_keyed_answer_selected!==0) errors.push(item.id+': non-keyed answer must be 0 points');
    for(const field of ['partial_credit','negative_marking','multiple_response','free_response_scoring','manual_grading_required']){
      if(m[field]!==false) errors.push(item.id+': '+field+' must be false');
    }
    if(m.item_weight!==1) errors.push(item.id+': item_weight must be 1');

    const e=item.approval_effect_if_later_confirmed||{};
    if(e.scoring_definition_approved!==true) errors.push(item.id+': hypothetical scoring_definition_approved must be true');
    for(const field of ['scored_delivery_enabled','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=prep.summary||{};
  if(s.items_with_scoring_definitions_prepared!==3) errors.push('summary prepared count must be 3');
  if(s.recommended_one_point_binary_scoring!==3) errors.push('summary scoring model count must be 3');
  for(const field of ['human_scoring_definition_decisions_recorded','scoring_definitions_approved_count','scored_delivery_enabled_count','assessment_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(prep.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'items_with_scoring_definitions_prepared: '+s.items_with_scoring_definitions_prepared,
    'recommended_one_point_binary_scoring: '+s.recommended_one_point_binary_scoring,
    'human_scoring_definition_decisions_recorded: '+s.human_scoring_definition_decisions_recorded,
    'scoring_definitions_approved_count: '+s.scoring_definitions_approved_count,
    'scored_delivery_enabled_count: '+s.scored_delivery_enabled_count,
    'assessment_eligible_count: '+s.assessment_eligible_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system scoring definitions are exact-payload-bound and grant no scoring or assessment authority.');
}

module.exports={validate,formatSummary};