'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-human-review-prep-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const validationPath=options.validationPath||path.join(root,'data','evidence','validation-results','charging-system-formative-question-drafts-deterministic-validation-20261004.json');
  const prep=readJson(prepPath);
  const draft=readJson(draftPath);
  const validation=readJson(validationPath);
  const errors=[];

  if(prep.artifact_type!=='formative-item-human-review-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='human-review-prepared-no-human-decisions') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==validation.source_artifact_canonical_sha256) errors.push('source canonical hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const qBy=new Map(draft.questions.map(q=>[q.id,q]));
  const vBy=new Map(validation.items.map(v=>[v.id,v]));
  if((prep.items||[]).length!==3) errors.push('must prepare exactly three items');

  for(const item of prep.items||[]){
    const q=qBy.get(item.id);
    const v=vBy.get(item.id);
    if(!q){errors.push(item.id+': source draft missing');continue;}
    if(!v){errors.push(item.id+': deterministic validation missing');continue;}
    if(item.claim_id!==q.claim_id||item.claim_id!==v.claim_id) errors.push(item.id+': claim linkage mismatch');
    if(item.canonical_item_sha256!==v.canonical_item_sha256) errors.push(item.id+': item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(item.deterministic_validation_result!=='valid') errors.push(item.id+': validation result must be valid');

    const snap=item.review_snapshot||{};
    for(const field of ['stem','answer','explanation','source_final_content_text']){
      if(snap[field]!==q[field]) errors.push(item.id+': snapshot '+field+' mismatch');
    }
    if(JSON.stringify(snap.choices)!==JSON.stringify(q.choices)) errors.push(item.id+': snapshot choices mismatch');

    for(const gate of ['rights_confirmation','technical_review','instructional_review','safety_review']){
      const g=item[gate]||{};
      if(g.reviewer!==null) errors.push(item.id+': '+gate+' reviewer must remain null');
      if(g.reviewed_at!==null) errors.push(item.id+': '+gate+' reviewed_at must remain null');
      if(g.human_decision!=='pending') errors.push(item.id+': '+gate+' decision must remain pending');
      if(!g.recommendation) errors.push(item.id+': '+gate+' recommendation missing');
    }

    const f=item.final_item_approval||{};
    if(f.reviewer!==null||f.reviewed_at!==null) errors.push(item.id+': final item reviewer/time must remain null');
    if(f.human_decision!=='pending') errors.push(item.id+': final item decision must remain pending');
    if(f.recommendation!=='not-yet-eligible-for-final-item-approval') errors.push(item.id+': final item recommendation must remain closed');

    const e=item.governance_effect||{};
    for(const field of ['scored','assessment_eligible','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(e[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }
  }

  const s=prep.summary||{};
  for(const field of ['items_prepared_for_human_review','rights_confirmations_prepared','technical_reviews_prepared','instructional_reviews_prepared','safety_reviews_prepared']){
    if(s[field]!==3) errors.push('summary.'+field+' must be 3');
  }
  for(const field of ['human_rights_decisions_recorded','human_technical_decisions_recorded','human_instructional_decisions_recorded','human_safety_decisions_recorded','human_final_item_approvals_recorded','scored_count','assessment_eligible_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }
  const blocked=(prep.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'items_prepared_for_human_review: '+s.items_prepared_for_human_review,
    'rights_confirmations_prepared: '+s.rights_confirmations_prepared,
    'technical_reviews_prepared: '+s.technical_reviews_prepared,
    'instructional_reviews_prepared: '+s.instructional_reviews_prepared,
    'safety_reviews_prepared: '+s.safety_reviews_prepared,
    'human_final_item_approvals_recorded: '+s.human_final_item_approvals_recorded,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system formative human-review preparation is exact-payload-bound and fail-closed.');
}
module.exports={validate,formatSummary};