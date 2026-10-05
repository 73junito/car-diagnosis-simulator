'use strict';
const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-production-assessment-api-eligibility-prep-20261005.json');
  const deliveryPath=options.deliveryPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scored-delivery-decisions-20261005.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const prep=readJson(prepPath), delivery=readJson(deliveryPath), draft=readJson(draftPath);
  const errors=[];

  if(prep.artifact_type!=='production-assessment-api-eligibility-review-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='production-assessment-api-review-prepared-remain-ineligible') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==delivery.source_artifact_canonical_sha256) errors.push('delivery source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const delBy=new Map(delivery.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((prep.items||[]).length!==3) errors.push('must review exactly three items');

  for(const item of prep.items||[]){
    const d=delBy.get(item.id), q=draftBy.get(item.id);
    if(!d||!q){errors.push(item.id+': missing delivery/draft linkage');continue;}
    if(item.claim_id!==d.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==d.canonical_item_sha256) errors.push(item.id+': delivery hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(d.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const r=item.production_assessment_api_readiness||{};
    if(r.status!=='not-ready-for-positive-eligibility-decision') errors.push(item.id+': readiness status mismatch');
    if(r.production_assessment_api_eligible!==false) errors.push(item.id+': API eligibility must remain false');
    for(const field of ['verified_route_contract_exists','verified_auth_gate','verified_assignment_or_scope_gate','verified_exact_item_hash_enforcement','verified_scoring_definition_enforcement','verified_attempt_state_validation','verified_fail_closed_behavior','verified_no_broader_assessment_authority']){
      if(r[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }

    const p=item.proposed_human_decision||{};
    if(p.status!=='prepared-awaiting-explicit-human-decision') errors.push(item.id+': human decision status mismatch');
    if(p.reviewer_identity!==null||p.reviewed_at!==null) errors.push(item.id+': reviewer/time must remain null');
    if(p.recommended_decision!=='remain-production-assessment-api-ineligible-pending-runtime-contract-and-fail-closed-verification') errors.push(item.id+': recommendation mismatch');

    const e=item.governance_effect_if_recommended_decision_is_approved||{};
    if(e.production_assessment_api_eligible!==false) errors.push(item.id+': recommended decision must keep API ineligible');
    if(e.scored_delivery_enabled_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': scored delivery must remain true');
    if(e.assessment_eligible_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': formative eligibility must remain true');
    for(const field of ['institutional_assessment_eligible','high_stakes_eligible','certification_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=prep.summary||{};
  if(s.items_reviewed_for_production_assessment_api_readiness!==3) errors.push('summary reviewed count must be 3');
  if(s.items_with_low_stakes_scored_delivery_enabled!==3) errors.push('summary scored delivery count must be 3');
  if(s.positive_api_eligibility_recommendations!==0) errors.push('positive API recommendations must be 0');
  if(s.recommended_remain_api_ineligible_count!==3) errors.push('remain-ineligible recommendation count must be 3');
  for(const field of ['human_api_eligibility_decisions_recorded','production_assessment_api_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','certification_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  return {errors,prep};
}

if(require.main===module){
  const r=validate();
  console.log('items_reviewed_for_production_assessment_api_readiness: '+r.prep.summary.items_reviewed_for_production_assessment_api_readiness);
  console.log('positive_api_eligibility_recommendations: '+r.prep.summary.positive_api_eligibility_recommendations);
  console.log('production_assessment_api_eligible_count: '+r.prep.summary.production_assessment_api_eligible_count);
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: production assessment API review remains fail-closed pending route-level verification.');
}
module.exports={validate};