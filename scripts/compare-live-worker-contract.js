'use strict';
const fs=require('node:fs'),path=require('node:path');
const {audit}=require('./audit-worker-config-contract');
function compareLive(root,liveReport){
 if(!liveReport||liveReport.read_only!==true||liveReport.completed+liveReport.failed!==6||!Array.isArray(liveReport.workers))throw Error('Invalid collection evidence');
 const expected=audit(root).workers;
 const rows=expected.map(worker=>{
  const live=liveReport.workers.find(x=>x.name===worker.name);
  if(!live)return {name:worker.name,status:'missing_live_evidence',details:[]};
  if(worker.classification==='legacy_unmanaged')return {name:worker.name,status:'legacy_manual_review',details:[]};
  const details=[];
  for(const field of ['durable_object_bindings','secrets_store_binding_names']){
   if(JSON.stringify(worker[field]||[])!==JSON.stringify(live[field]||[]))details.push({field,status:'mismatch',expected:worker[field],live:live[field]});
  }
  for(const [key,value] of Object.entries(worker.flags||{})){
   if(value===null)continue;
   if(!Object.hasOwn(live.flags||{},key))details.push({field:key,status:'unverified_live_flag'});
   else if(live.flags[key]!==value)details.push({field:key,status:'mismatch',expected:value,live:live.flags[key]});
  }
  details.push({field:'routes',status:'unverified_by_settings_endpoint'});
  return {name:worker.name,status:details.some(x=>x.status==='mismatch')?'drift_detected':details.some(x=>x.status.startsWith('unverified'))?'partial_verified':'verified_fields_match',details};
 });
 return {read_only:true,deletion_authorized:false,summary:{workers:rows.length,drift:rows.filter(x=>x.status==='drift_detected').length,partial:rows.filter(x=>x.status==='partial_verified').length,legacy:rows.filter(x=>x.status==='legacy_manual_review').length},workers:rows};
}
if(require.main===module){
 try{const [,,root,live,out]=process.argv;if(!out)throw Error('Usage: node scripts/compare-live-worker-contract.js REPO_ROOT LIVE.json OUTPUT.json');const r=compareLive(root,JSON.parse(fs.readFileSync(live,'utf8')));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r.summary));}
 catch(e){console.error(e.message);process.exitCode=1}
}
module.exports={compareLive};
