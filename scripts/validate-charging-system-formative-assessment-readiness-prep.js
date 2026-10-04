'use strict';

const fs=require('fs');
const path=require('path');
const {canonicalHash}=require('./validate-charging-system-formative-deterministic-validation');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-formative-assessment-readiness-prep-20261004.json');
  const finalPath=options.finalPath||path.join(root,'data','evidence','review-queues','charging-system-formative-final-item-decisions-20261004.json');
  const draftPath=options.draftPath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const prep=readJson(prepPath);
  const final=readJson(finalPath);
  const draft=readJson(draftPath);
  const errors=[];

  if(prep.artifact_type!=='formative-item-assessment-readiness-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='assessment-readiness-prepared-no-eligibility-change') errors.push('stage mismatch');
  if(prep.source_artifact_canonical_sha256!==final.source_artifact_canonical_sha256) errors.push('final-decision source hash mismatch');
  if(prep.source_artifact_canonical_sha256!==canonicalHash(draft)) errors.push('draft package canonical hash mismatch');

  const finalBy=new Map(final.decisions.map(x=>[x.id,x]));
  const draftBy=new Map(draft.questions.map(x=>[x.id,x]));
  if((prep.items||[]).length!==3) errors.push('must prepare exactly three items');

  for(const item of prep.items||[]){
    const f=finalBy.get(item.id);
    const q=draftBy.get(item.id);
    if(!f||!q){errors.push(item.id+': missing final/draft linkage');continue;}
    if(item.claim_id!==f.claim_id||item.claim_id!==q.claim_id) errors.push(item.id+': claim mismatch');
    if(item.canonical_item_sha256!==f.canonical_item_sha256) errors.push(item.id+': final item hash mismatch');
    if(item.canonical_item_sha256!==canonicalHash(q)) errors.push(item.id+': current item hash mismatch');
    if(JSON.stringify(item.review_snapshot)!==JSON.stringify(f.review_snapshot)) errors.push(item.id+': review snapshot mismatch');

    const g=item.current_governance||{};
    if(g.deterministic_validation!=='complete-valid') errors.push(item.id+': deterministic validation incomplete');
    for(const field of ['rights_review','technical_review','instructional_review','safety_review']){
      if(g[field]!=='approved') errors.push(item.id+': '+field+' must be approved');
    }
    if(g.final_item_approval!=='approved-for-governed-formative-use') errors.push(item.id+': final formative approval mismatch');
    if(g.formative_use_approved!==true) errors.push(item.id+': formative use must be approved');

    const a=item.assessment_readiness||{};
    if(a.status!=='prepared-for-separate-human-assessment-eligibility-review') errors.push(item.id+': readiness status mismatch');
    if(a.reviewer_identity!==null||a.reviewed_at!==null) errors.push(item.id+': reviewer/time must remain null');
    if(a.recommendation!=='remain-assessment-ineligible-pending-separate-scoring-and-eligibility-governance') errors.push(item.id+': recommendation mismatch');
    for(const field of ['assessment_eligible','scored','institutional_assessment_eligible','high_stakes_eligible','production_assessment_api_eligible','assessment_release','production_release']){
      if(a[field]!==false) errors.push(item.id+': '+field+' must remain false');
    }

    if((item.satisfied_prerequisites||[]).length!==7) errors.push(item.id+': expected seven satisfied prerequisites');
    if((item.remaining_blockers_before_any_assessment_eligibility_decision||[]).length!==2) errors.push(item.id+': expected two remaining blockers');
  }

  const s=prep.summary||{};
  if(s.final_formative_items_reviewed_for_assessment_readiness!==3) errors.push('summary reviewed count must be 3');
  if(s.prepared_for_separate_human_assessment_eligibility_review!==3) errors.push('summary prepared count must be 3');
  if(s.satisfied_item_governance_prerequisite_count_per_item!==7) errors.push('summary prerequisite count must be 7');
  for(const field of ['human_assessment_eligibility_decisions_recorded','scored_count','assessment_eligible_count','institutional_assessment_eligible_count','high_stakes_eligible_count','production_assessment_api_eligible_count','assessment_release_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }

  const blocked=(prep.blocked_claims||[]).map(x=>x.claim_id);
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'final_formative_items_reviewed_for_assessment_readiness: '+s.final_formative_items_reviewed_for_assessment_readiness,
    'prepared_for_separate_human_assessment_eligibility_review: '+s.prepared_for_separate_human_assessment_eligibility_review,
    'human_assessment_eligibility_decisions_recorded: '+s.human_assessment_eligibility_decisions_recorded,
    'scored_count: '+s.scored_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system formative assessment-readiness preparation preserves separate scoring and eligibility gates.');
}

module.exports={validate,formatSummary};