const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const decisionPath=options.decisionPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-decisions-20261003.json');
  const prepPath=options.prepPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-prep-20261003.json');
  const decisions=readJson(decisionPath);
  const prep=readJson(prepPath);
  const errors=[];

  if(decisions.artifact_type!=='human-final-content-approval-decisions') errors.push('artifact_type mismatch');
  if(decisions.stage!=='final-content-approved-assessment-eligibility-pending') errors.push('stage mismatch');

  const prepBy=new Map(prep.reviews.map(r=>[r.claim_id,r]));
  const rows=decisions.decisions||[];
  if(rows.length!==3) errors.push('must record exactly three final approval decisions');
  if(new Set(rows.map(r=>r.claim_id)).size!==rows.length) errors.push('duplicate claim_id');

  for(const row of rows){
    const p=prepBy.get(row.claim_id);
    if(!p){errors.push(row.claim_id+': missing final approval prep');continue;}
    if(row.final_content_text!==p.final_content_text) errors.push(row.claim_id+': final content text mismatch');
    if(row.instructional_scope!==p.instructional_scope) errors.push(row.claim_id+': instructional scope mismatch');
    if(row.final_decision!=='approved-for-governed-instructional-content') errors.push(row.claim_id+': final decision mismatch');
    if(row.reviewer_identity!=='Rafael Rodriguez Jr.') errors.push(row.claim_id+': reviewer mismatch');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.reviewed_at||'')) errors.push(row.claim_id+': invalid reviewed_at');
    if(row.technical_status!=='reviewed') errors.push(row.claim_id+': technical status must be reviewed');
    if(row.citation_status!=='validated') errors.push(row.claim_id+': citation status must be validated');
    if(row.instructional_status!=='reviewed') errors.push(row.claim_id+': instructional status must be reviewed');
    if(row.assessment_eligible!==false) errors.push(row.claim_id+': assessment eligibility must remain false');
    for(const denied of ['assessment eligibility','scoring or grading use','question-bank approval','production release of assessment items']){
      if(!(row.prohibited_by_this_decision||[]).includes(denied)) errors.push(row.claim_id+': missing prohibited capability '+denied);
    }
  }

  const expected=['charging-system-challenge-claim-05','charging-system-challenge-claim-07','charging-system-challenge-claim-08'];
  for(const id of expected) if(!rows.some(r=>r.claim_id===id)) errors.push('missing approved claim '+id);

  const blocked=(decisions.blocked_claims||[]).map(r=>r.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must be 02 and 12');

  const s=decisions.summary;
  if(s.human_final_decisions_recorded!==3) errors.push('human_final_decisions_recorded must be 3');
  if(s.final_approved_count!==3) errors.push('final_approved_count must be 3');
  if(s.assessment_eligible_count!==0) errors.push('assessment_eligible_count must remain 0');

  return {errors,decisions};
}

function formatSummary(s){
  return [
    'human_final_decisions_recorded: '+s.human_final_decisions_recorded,
    'final_approved_count: '+s.final_approved_count,
    'assessment_eligible_count: '+s.assessment_eligible_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.decisions.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: charging-system final content decisions validate fail-closed.');
}
module.exports={validate,formatSummary};