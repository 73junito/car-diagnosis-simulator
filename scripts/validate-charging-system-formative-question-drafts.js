const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const finalPath=options.finalPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-decisions-20261003.json');
  const readinessPath=options.readinessPath||path.join(root,'data','evidence','review-queues','charging-system-assessment-eligibility-prep-20261003.json');
  const draft=readJson(draftPath);
  const final=readJson(finalPath);
  const readiness=readJson(readinessPath);
  const errors=[];

  if(draft.artifact_type!=='formative-question-draft-package') errors.push('artifact_type mismatch');
  if(draft.stage!=='formative-drafts-created-pending-item-level-governance') errors.push('stage mismatch');
  if(draft.question_count!==3) errors.push('question_count must be 3');

  const finalBy=new Map(final.decisions.map(r=>[r.claim_id,r]));
  const readyBy=new Map(readiness.reviews.map(r=>[r.claim_id,r]));
  const qs=draft.questions||[];
  if(qs.length!==3) errors.push('must contain exactly three drafts');
  if(new Set(qs.map(q=>q.id)).size!==qs.length) errors.push('duplicate question id');
  if(new Set(qs.map(q=>q.claim_id)).size!==qs.length) errors.push('one draft per claim required');

  for(const q of qs){
    const f=finalBy.get(q.claim_id);
    const r=readyBy.get(q.claim_id);
    if(!f) { errors.push(q.claim_id+': missing final approval'); continue; }
    if(!r) { errors.push(q.claim_id+': missing assessment-readiness record'); continue; }
    if(q.source_final_content_text!==f.final_content_text) errors.push(q.claim_id+': source final content mismatch');
    if(r.assessment_eligible!==false) errors.push(q.claim_id+': readiness must remain assessment-ineligible');
    if(r.formative_draft_generation_allowed!==true) errors.push(q.claim_id+': formative draft generation not allowed');

    if(typeof q.stem!=='string'||q.stem.trim().length<20) errors.push(q.id+': stem missing/too short');
    const labels=['A','B','C','D'];
    if(JSON.stringify(Object.keys(q.choices||{}))!==JSON.stringify(labels)) errors.push(q.id+': choices must be A-D exactly');
    if(!labels.includes(q.answer)) errors.push(q.id+': answer must be A-D');
    if(typeof q.explanation!=='string'||q.explanation.trim().length<40) errors.push(q.id+': explanation missing/too short');

    if(q.status!=='draft-pending-item-level-review') errors.push(q.id+': status must remain draft');
    if(q.deliveryMode!=='formative-draft') errors.push(q.id+': delivery mode must remain formative-draft');
    for(const field of ['scored','assessmentEligible','institutionalAssessmentEligible','highStakesEligible','productionAssessmentApiEligible','productionRelease','assessmentRelease','autoApproval']){
      if(q[field]!==false) errors.push(q.id+': '+field+' must remain false');
    }

    const g=q.item_level_governance||{};
    if(g.rights_review!=='pending-item-level-confirmation') errors.push(q.id+': rights review must remain pending');
    for(const field of ['technical_review','instructional_review','safety_review','deterministic_item_validation','human_item_approval']){
      if(g[field]!=='pending') errors.push(q.id+': '+field+' must remain pending');
    }

    const combined=[q.stem,...Object.values(q.choices||{}),q.explanation].join(' ');
    if(/\b\d+(\.\d+)?\s*(?:V|A|amp|amps|volts?|percent|%)\b/i.test(combined)) errors.push(q.id+': universal numeric threshold/value detected');
  }

  const expected=['charging-system-challenge-claim-05','charging-system-challenge-claim-07','charging-system-challenge-claim-08'];
  for(const id of expected) if(!qs.some(q=>q.claim_id===id)) errors.push('missing draft for '+id);

  const blocked=(draft.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  const s=draft.summary||{};
  if(s.formative_drafts_created!==3) errors.push('formative_drafts_created must be 3');
  if(s.drafts_pending_item_level_review!==3) errors.push('drafts_pending_item_level_review must be 3');
  for(const field of ['human_item_approvals_recorded','scored_count','assessment_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  return {errors,draft};
}

function formatSummary(s){
  return [
    'formative_drafts_created: '+s.formative_drafts_created,
    'drafts_pending_item_level_review: '+s.drafts_pending_item_level_review,
    'human_item_approvals_recorded: '+s.human_item_approvals_recorded,
    'scored_count: '+s.scored_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.draft.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system formative draft package is structurally valid and fail-closed.');
}
module.exports={validate,formatSummary};