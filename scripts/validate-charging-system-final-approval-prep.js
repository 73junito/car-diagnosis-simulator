const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-prep-20261003.json');
  const instPath=options.instPath||path.join(root,'data','evidence','review-queues','charging-system-instructional-review-decisions-20261003.json');
  const prep=readJson(prepPath);
  const inst=readJson(instPath);
  const errors=[];

  if(prep.artifact_type!=='final-content-approval-preparation') errors.push('artifact_type mismatch');
  if(prep.stage!=='final-content-recommendations-awaiting-named-human-approval') errors.push('stage mismatch');

  const instBy=new Map(inst.decisions.map(r=>[r.claim_id,r]));
  const rows=prep.reviews||[];
  if(rows.length!==3) errors.push('must prepare exactly three final approval recommendations');
  if(new Set(rows.map(r=>r.claim_id)).size!==rows.length) errors.push('duplicate claim_id');

  for(const row of rows){
    const i=instBy.get(row.claim_id);
    if(!i){errors.push(row.claim_id+': missing instructional decision');continue;}
    if(row.final_content_text!==i.accepted_instructional_text) errors.push(row.claim_id+': final_content_text must match accepted instructional text');
    if(row.instructional_scope!==i.instructional_scope) errors.push(row.claim_id+': instructional_scope mismatch');
    if(row.technical_status!=='reviewed') errors.push(row.claim_id+': technical_status must be reviewed');
    if(row.citation_status!=='validated') errors.push(row.claim_id+': citation_status must be validated');
    if(row.instructional_status!=='reviewed') errors.push(row.claim_id+': instructional_status must be reviewed');
    if(row.final_approval_status!=='pending-human-final-approval') errors.push(row.claim_id+': final approval must remain pending');
    if(row.reviewer_identity!==null) errors.push(row.claim_id+': reviewer_identity must remain null');
    if(row.reviewed_at!==null) errors.push(row.claim_id+': reviewed_at must remain null');
    if(row.recommended_final_disposition!=='approve-for-governed-instructional-content') errors.push(row.claim_id+': recommendation mismatch');
    if(row.assessment_eligible!==false) errors.push(row.claim_id+': assessment eligibility must remain false');
    const checks=row.safety_and_scope_check||{};
    for(const key of ['no_universal_diagnostic_threshold_added','no_scoring_rule_added','no_question_payload_added','no_assessment_eligibility_change','scope_preserved']){
      if(checks[key]!==true) errors.push(row.claim_id+': safety_and_scope_check.'+key+' must be true');
    }
    const denied=row.not_allowed_by_this_gate||[];
    for(const required of ['assessment eligibility','scoring or grading use','question-bank approval','production release of assessment items']){
      if(!denied.includes(required)) errors.push(row.claim_id+': missing denied capability '+required);
    }
  }

  const expected=['charging-system-challenge-claim-05','charging-system-challenge-claim-07','charging-system-challenge-claim-08'];
  for(const id of expected) if(!rows.some(r=>r.claim_id===id)) errors.push('missing eligible claim '+id);

  const blocked=(prep.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must be 02 and 12');

  const s=prep.summary;
  if(s.claims_eligible_for_final_content_approval!==3) errors.push('eligible count must be 3');
  if(s.final_approval_recommendations_prepared!==3) errors.push('prepared count must be 3');
  if(s.recommended_approve_for_governed_instructional_content!==3) errors.push('recommendation count must be 3');
  if(s.human_final_decisions_recorded!==0) errors.push('human_final_decisions_recorded must remain 0');
  if(s.final_approved_count!==0) errors.push('final_approved_count must remain 0');
  if(s.assessment_eligible_count!==0) errors.push('assessment_eligible_count must remain 0');

  return {errors,prep};
}

function formatSummary(s){
  return [
    'claims_eligible_for_final_content_approval: '+s.claims_eligible_for_final_content_approval,
    'final_approval_recommendations_prepared: '+s.final_approval_recommendations_prepared,
    'recommended_approve_for_governed_instructional_content: '+s.recommended_approve_for_governed_instructional_content,
    'human_final_decisions_recorded: '+s.human_final_decisions_recorded,
    'final_approved_count: '+s.final_approved_count,
    'assessment_eligible_count: '+s.assessment_eligible_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.prep.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system final-approval preparation remains fail-closed.');
}
module.exports={validate,formatSummary};