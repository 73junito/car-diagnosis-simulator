const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionPath=options.decisionPath||path.join(root,'data','evidence','review-queues','charging-system-instructional-review-decisions-20261003.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-instructional-review-prep-20261003.json');
  const decisions=readJson(decisionPath);
  const prep=readJson(prepPath);
  const errors=[];

  if(decisions.artifact_type!=='human-instructional-review-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='instructional-review-complete-pending-final-approval') errors.push('stage mismatch');

  const prepBy=new Map(prep.reviews.map(r=>[r.claim_id,r]));
  const rows=decisions.decisions||[];
  if(rows.length!==3) errors.push('must record exactly three instructional decisions');
  if(new Set(rows.map(r=>r.claim_id)).size!==rows.length) errors.push('duplicate claim_id');

  let revised=0,retained=0;
  for(const row of rows){
    const p=prepBy.get(row.claim_id);
    if(!p){errors.push(row.claim_id+': not present in prep');continue;}
    if(row.source_claim_text!==p.current_approved_claim_text) errors.push(row.claim_id+': source_claim_text mismatch');
    if(row.accepted_instructional_text!==p.recommended_instructional_text) errors.push(row.claim_id+': accepted text must match explicitly approved recommendation');
    if(row.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(row.claim_id+': reviewer mismatch');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.reviewed_at||'')) errors.push(row.claim_id+': invalid reviewed_at');
    if(row.citation_status!=='validated') errors.push(row.claim_id+': citation must remain validated');
    if(row.technical_status!=='reviewed') errors.push(row.claim_id+': technical must remain reviewed');
    if(row.final_approval_status!=='pending') errors.push(row.claim_id+': final approval must remain pending');
    if(row.assessment_eligible!==false) errors.push(row.claim_id+': assessment eligibility must remain false');

    if(row.instructional_decision==='approved-with-instructional-revision'){
      revised++;
      if(row.accepted_instructional_text===row.source_claim_text) errors.push(row.claim_id+': revised decision must change learner-facing text');
    }else if(row.instructional_decision==='approved-as-written-with-instructional-scope'){
      retained++;
      if(row.accepted_instructional_text!==row.source_claim_text) errors.push(row.claim_id+': as-written decision must preserve text');
    }else{
      errors.push(row.claim_id+': invalid instructional_decision');
    }
  }

  for(const id of ['charging-system-challenge-claim-05','charging-system-challenge-claim-07']){
    const row=rows.find(r=>r.claim_id===id);
    if(!row||row.instructional_decision!=='approved-with-instructional-revision') errors.push(id+': expected approved-with-instructional-revision');
  }
  const c08=rows.find(r=>r.claim_id==='charging-system-challenge-claim-08');
  if(!c08||c08.instructional_decision!=='approved-as-written-with-instructional-scope') errors.push('claim-08 expected approved-as-written-with-instructional-scope');

  const blocked=(decisions.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must be 02 and 12');

  const s=decisions.summary;
  if(s.instructional_decisions_recorded!==3) errors.push('summary decisions must be 3');
  if(s.approved_with_instructional_revision!==revised) errors.push('summary revised mismatch');
  if(s.approved_as_written_with_instructional_scope!==retained) errors.push('summary retained mismatch');
  if(s.instructional_reviewed_count!==3) errors.push('instructional_reviewed_count must be 3');
  if(s.final_approved_count!==0) errors.push('final_approved_count must remain 0');
  if(s.assessment_eligible_count!==0) errors.push('assessment_eligible_count must remain 0');

  return {errors,decisions};
}

function formatSummary(s){
  return [
    'instructional_decisions_recorded: '+s.instructional_decisions_recorded,
    'approved_with_instructional_revision: '+s.approved_with_instructional_revision,
    'approved_as_written_with_instructional_scope: '+s.approved_as_written_with_instructional_scope,
    'instructional_reviewed_count: '+s.instructional_reviewed_count,
    'final_approved_count: '+s.final_approved_count,
    'assessment_eligible_count: '+s.assessment_eligible_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.decisions.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system human instructional decisions validate fail-closed.');
}
module.exports={validate,formatSummary};