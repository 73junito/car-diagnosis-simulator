const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const citationPath=options.citationPath||path.join(root,'data','evidence','review-queues','charging-system-citation-validation-20261003.json');
  const techPath=options.techPath||path.join(root,'data','evidence','review-queues','charging-system-technical-review-decisions-20261003.json');
  const rightsPath=options.rightsPath||path.join(root,'data','evidence','review-queues','charging-system-rights-review-records-20261003.json');
  const artifact=readJson(citationPath);
  const tech=readJson(techPath);
  const rights=readJson(rightsPath);
  const errors=[];

  if(artifact.artifact_type!=='claim-citation-validation') errors.push('artifact_type mismatch');
  if(artifact.scenario_id!=='charging-system') errors.push('scenario_id mismatch');
  if(artifact.stage!=='citation-validation-partial-pending-artifact-verification') errors.push('stage mismatch');

  const techBy=new Map(tech.reviews.map(r=>[r.claim_id,r]));
  const rightsBy=new Map(rights.reviews.map(r=>[r.candidate_id,r]));
  const rows=artifact.validations||[];

  if(rows.length!==5) errors.push('must validate exactly five technically reviewed claims');
  if(new Set(rows.map(r=>r.claim_id)).size!==rows.length) errors.push('duplicate claim_id');

  let valid=0,pending=0;
  for(const row of rows){
    const tr=techBy.get(row.claim_id);
    if(!tr){errors.push(row.claim_id+': missing technical decision'); continue;}
    if(row.approved_claim_text!==tr.approved_claim_text) errors.push(row.claim_id+': must use approved_claim_text');
    const isValid=row.citation_validation_status==='validated'&&row.citation_validated===true;
    const isPending=row.citation_validation_status==='pending-artifact-verification'&&row.citation_validated===false;
    if(!isValid&&!isPending) errors.push(row.claim_id+': invalid citation validation state');
    if(isValid) valid++;
    if(isPending) pending++;

    if(!Array.isArray(row.sources)||row.sources.length===0) errors.push(row.claim_id+': sources required');
    let directVerified=0;
    let requiredUnverified=0;
    for(const source of row.sources||[]){
      const rr=rightsBy.get(source.candidate_id);
      if(!rr) errors.push(row.claim_id+': unknown source '+source.candidate_id);
      else{
        if(source.rights_decision!==rr.rights_decision) errors.push(row.claim_id+': rights_decision mismatch for '+source.candidate_id);
        if(source.artifact_sha256!==rr.artifact_sha256) errors.push(row.claim_id+': artifact_sha256 mismatch for '+source.candidate_id);
      }
      if(source.support_status==='validated-primary-support'&&source.locator_status!=='corroborated-not-artifact-verified') directVerified++;
      if(source.support_status==='required-support-pending-verification') requiredUnverified++;
    }
    if(isValid&&directVerified<1) errors.push(row.claim_id+': validated claim requires verified primary support');
    if(isValid&&requiredUnverified>0) errors.push(row.claim_id+': validated claim cannot depend on required unverified support');
    if(isPending&&requiredUnverified<1) errors.push(row.claim_id+': pending claim requires explicit unverified dependency');

    if(!Number.isInteger(row.validated_source_count)||row.validated_source_count<0) errors.push(row.claim_id+': invalid validated_source_count');
    if(!Number.isInteger(row.pending_source_count)||row.pending_source_count<0) errors.push(row.claim_id+': invalid pending_source_count');
  }

  const expectedValid=['charging-system-challenge-claim-05','charging-system-challenge-claim-07','charging-system-challenge-claim-08'];
  for(const id of expectedValid){
    const row=rows.find(r=>r.claim_id===id);
    if(!row||row.citation_validation_status!=='validated') errors.push(id+': must be validated');
  }
  for(const id of ['charging-system-challenge-claim-02','charging-system-challenge-claim-12']){
    const row=rows.find(r=>r.claim_id===id);
    if(!row||row.citation_validation_status!=='pending-artifact-verification') errors.push(id+': must remain pending artifact verification');
  }

  const s=artifact.summary;
  if(s.technically_reviewed_claims!==5) errors.push('summary technically_reviewed_claims must be 5');
  if(s.citation_validated_count!==valid) errors.push('summary citation_validated_count mismatch');
  if(s.citation_pending_count!==pending) errors.push('summary citation_pending_count mismatch');
  for(const field of ['instructional_reviewed_count','approved_count','assessment_eligible_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }
  return {errors,artifact};
}

function formatSummary(s){
 return [
  'technically_reviewed_claims: '+s.technically_reviewed_claims,
  'citation_validated_count: '+s.citation_validated_count,
  'citation_pending_count: '+s.citation_pending_count,
  'instructional_reviewed_count: '+s.instructional_reviewed_count,
  'approved_count: '+s.approved_count,
  'assessment_eligible_count: '+s.assessment_eligible_count
 ].join('\n');
}

if(require.main===module){
 const r=validate();
 console.log(formatSummary(r.artifact.summary));
 if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
 else console.log('PASS: charging-system citation validation remains fail-closed.');
}
module.exports={validate,formatSummary};