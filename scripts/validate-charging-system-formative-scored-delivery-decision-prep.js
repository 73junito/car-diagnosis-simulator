'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scored-delivery-decision-prep-20261005.json');
  const eligibilityPath=options.eligibilityPath||path.join(root,'data','evidence','review-queues','charging-system-formative-assessment-eligibility-decisions-20261005.json');
  const scoringPath=options.scoringPath||path.join(root,'data','evidence','review-queues','charging-system-formative-scoring-definition-decisions-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');

  const prep=readJson(prepPath);
  const eligibility=readJson(eligibilityPath);
  const scoring=readJson(scoringPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(prep.artifact_type!=='formative-item-scored-delivery-decision-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='scored-delivery-decision-prepared-no-enablement') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==eligibility.source_artifact_canonical_sha256) errors.push('eligibility source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==scoring.source_artifact_canonical_sha256) errors.push('scoring source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const eligBy=new Map(eligibility.items.map(x=>[x.id,x]));
  const scoreBy=new Map(scoring.items.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));

  if((prep.items||[]).length!==3) errors.push('must prepare exactly three scored-delivery decisions');

  for(const item of prep.items||[]){
    const e=eligBy.get(item.id);
    const s=scoreBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!e||!s||!q){errors.push(item.id+': missing prerequisite linkage');continue;}

    if(item.claim_id!==e.claim_id||item.claim_id!==s.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==e.canonical_item_sha256||item.canonical_item_sha256!==s.canonical_item_sha256) errors.push(item.id+': prerequisite item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(e.review_snapshot)) errors.push(item.id+': review snapshot mismatch');
    if(JSON.stringify(item.approved_scoring_model)!==JSON.stringify(s.scoring_definition_decision.approved_scoring_model)) errors.push(item.id+': scoring model mismatch');
    if(JSON.stringify(item.approved_assessment_scope)!==JSON.stringify(e.assessment_eligibility_decision.approved_scope)) errors.push(item.id+': assessment scope mismatch');

    const p=item.proposed_scored_delivery_decision||{};
    if(p.status!=='prepared-awaiting-explicit-human-decision') errors.push(item.id+': status mismatch');
    if(p.reviewer_identity!==null||p.reviewed_at!==null) errors.push(item.id+': reviewer/time must remain null');
    if(p.recommended_decision!=='enable-scored-delivery-for-low-stakes-governed-formative-assessment-only') errors.push(item.id+': recommendation mismatch');
    if(p.scored_delivery_enabled!==false) errors.push(item.id+': scored_delivery_enabled must remain false');

    const ds=p.delivery_scope||{};
    if(ds.delivery_mode!=='scored-low-stakes-governed-formative-knowledge-check') errors.push(item.id+': delivery mode mismatch');
    if(ds.physical_action_authority!==false) errors.push(item.id+': physical action authority must be false');

    const effect=item.effect_if_later_approved_as_recommended||{};
    if(effect.scored_delivery_enabled_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': hypothetical scored delivery must be true');
    if(effect.assessment_eligible_for_low_stakes_governed_formative_use!==true) errors.push(item.id+': low-stakes eligibility must remain true');
    for(const field of ['institutional_assessment_eligible','high_stakes_eligible','certification_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(effect[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const sum=prep.summary||{};
  if(sum.items_prepared_for_human_scored_delivery_decision!==3) errors.push('summary prepared count must be 3');
  if(sum.items_with_approved_scoring_definition!==3) errors.push('summary scoring count must be 3');
  if(sum.items_with_low_stakes_formative_assessment_eligibility!==3) errors.push('summary eligibility count must be 3');
  for(const field of ['human_scored_delivery_decisions_recorded','scored_delivery_enabled_count','institutional_assessment_eligible_count','high_stakes_eligible_count','certification_eligible_count','production_assessment_api_eligible_count','assessment_release_count','production_release_count']){
    if(sum[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(prep.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'items_prepared_for_human_scored_delivery_decision: '+s.items_prepared_for_human_scored_delivery_decision,
    'human_scored_delivery_decisions_recorded: '+s.human_scored_delivery_decisions_recorded,
    'scored_delivery_enabled_count: '+s.scored_delivery_enabled_count,
    'institutional_assessment_eligible_count: '+s.institutional_assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: scored-delivery package is exact-payload-bound and grants no scored-delivery authority.');
}

module.exports={validate,formatSummary};