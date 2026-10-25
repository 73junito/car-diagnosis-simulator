'use strict';
// Review-only import gate. Never connects to a database or reproduces source text.
const register=require('../data/obd2/obd-source-register.json');
const sources=new Map(register.documents.map(s=>[s.id,s]));
function inspect(records){
 if(!Array.isArray(records))throw new TypeError('records must be an array');
 const issues=[],seen=new Map(),accepted=[];
 records.forEach((r,i)=>{
  const problems=[];
  if(!r||typeof r!=='object'||Array.isArray(r)){issues.push({index:i,reasons:['record_invalid']});return;}
  if(!['OBD_I','OBD_II'].includes(r.protocol))problems.push('protocol_invalid');
  if(typeof r.code!=='string'||!(/^[A-Z0-9-]{2,24}$/).test(r.code))problems.push('code_invalid');
  const src=sources.get(r.sourceId);
  if(!src)problems.push('source_unknown');
  else if(src.protocol!==r.protocol)problems.push('source_protocol_mismatch');
  if(!Number.isInteger(r.page)||r.page<1||(src&&r.page>src.pages))problems.push('page_invalid');
  const genericScope=r.protocol==='OBD_II'&&r.scope==='generic';
  if(!genericScope&&(typeof r.manufacturer!=='string'||!r.manufacturer.trim()||typeof r.model!=='string'||!r.model.trim()))problems.push('vehicle_applicability_missing');
  if(!genericScope&&(!Number.isInteger(r.yearFrom)||!Number.isInteger(r.yearTo)||r.yearFrom<1950||r.yearTo>2100||r.yearFrom>r.yearTo))problems.push('year_range_invalid');
  if(typeof r.description!=='string'||!r.description.trim())problems.push('description_missing');
  if(r.rightsVerified!==true)problems.push('rights_not_verified');
  if(r.technicalVerified!==true)problems.push('technical_verification_missing');
  // Uploaded PDF sources are currently review-only regardless of caller-supplied claims.
  if(src&&src.decision!=='approved_for_import')problems.push('source_not_approved');
  // Generic OBD-II may use unspecified vehicle scope; this is NOT vehicle-specific approval.
  const generic=r.protocol==='OBD_II'&&r.scope==='generic';
  if(generic && (r.manufacturer!=='generic'||r.model!=='unspecified'||r.yearFrom!=null||r.yearTo!=null))problems.push('generic_scope_invalid');
  const key=[r.protocol,r.code,r.manufacturer,r.model,r.yearFrom,r.yearTo].join('|');
  if(seen.has(key)){problems.push('potential_duplicate_or_context_collision');issues.push({index:seen.get(key),reasons:['potential_duplicate_or_context_collision']});}
  else seen.set(key,i);
  if(problems.length)issues.push({index:i,reasons:[...new Set(problems)]});
  else accepted.push(r);
 });
 return {status:issues.length?'review_required':'eligible_for_separate_import_review',acceptedCount:accepted.length,rejectedCount:records.length-accepted.length,issues,productionWritesAllowed:false};
}
module.exports={inspect};
if(require.main===module){const fs=require('fs');const filename=process.argv[2];if(!filename){console.error('Usage: node scripts/validate-obd-reference-import.js candidate.json');process.exitCode=2;}else{try{const result=inspect(JSON.parse(fs.readFileSync(filename,'utf8')));console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}}
