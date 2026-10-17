'use strict';
const fs=require('node:fs'),path=require('node:path');
function assess(ownership,eligibility){
 if(!ownership?.read_only||ownership.deletion_authorized!==false||!eligibility?.readOnly||eligibility.complete!==true)throw Error('Missing verified read-only evidence');
 if(!Array.isArray(ownership.rows)||!Array.isArray(eligibility.rows)||ownership.scanned!==eligibility.scanned||ownership.scanned!==ownership.rows.length||eligibility.scanned!==eligibility.rows.length||ownership.worker!==eligibility.worker)throw Error('Incomplete or mismatched manifests');
 const identities=new Set(), eligibleMap=new Map();
 for(const r of eligibility.rows){if(!r.builds_preview_id||eligibleMap.has(r.builds_preview_id))throw Error('Duplicate eligibility identity');eligibleMap.set(r.builds_preview_id,r)}
 const rows=ownership.rows.map(o=>{
  if(!o.builds_preview_id||identities.has(o.builds_preview_id))throw Error('Duplicate ownership identity');
  identities.add(o.builds_preview_id);
  const e=eligibleMap.get(o.builds_preview_id);
  if(!e||o.branch!==e.branch||o.live_status!==e.live_status||o.identity!==e.identity)throw Error('Manifest identity mismatch');
  let decision='retain_unverified';
  if(o.pr_state==='open')decision='retain_active_pr';
  else if(o.decision==='retain_closed_unmerged')decision='retain_closed_unmerged';
  else if(o.decision==='cleanup_review_only'&&e.eligibility==='retained')decision='retain_30_day_window';
  else if(o.decision==='cleanup_review_only'&&e.eligibility==='review_required')decision='dependency_evidence_required';
  return {branch:o.branch,preview_id:o.builds_preview_id,pr_number:o.pr_number,ownership:o.ownership,
   live_status:o.live_status,retention:e.eligibility,retention_reason:e.reason,decision,
   binding_dependency:'not_verified',storage_dependency:'not_verified',deletion_authorized:false};
 });
 const counts={};for(const r of rows)counts[r.decision]=(counts[r.decision]||0)+1;
 return {worker:ownership.worker,scanned:rows.length,read_only:true,deletion_authorized:false,
  counts,rows,warning:'Retention passing only triggers dependency review; no storage, rate limiter or Worker binding dependency is verified.'};
}
if(require.main===module){try{const [,,a,b,out]=process.argv;if(!out)throw Error('Usage: node scripts/assess-preview-retention-evidence.js OWNERSHIP.json ELIGIBILITY.json OUTPUT.json');const report=assess(JSON.parse(fs.readFileSync(a)),JSON.parse(fs.readFileSync(b)));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({scanned:report.scanned,counts:report.counts,deletion_authorized:false}))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={assess};
