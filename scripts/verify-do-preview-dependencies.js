'use strict';
const fs=require('node:fs'),path=require('node:path');
const {correlate,parseCsv}=require('./correlate-do-usage-evidence');
const baseWorkers=new Set(['autolearnpro-app','autolearnpro-app-staging','autolearnpro-public','autolearnpro-exam','car-diagnosis-simulator','car-diagnosis-simulator-staging']);
function verify(inventory,analytics,objects,ownership,retention){
 if(!ownership?.read_only||ownership?.deletion_authorized!==false||!Array.isArray(ownership.rows)||
    !retention?.read_only||retention?.deletion_authorized!==false||!Array.isArray(retention.rows))throw Error('Invalid ownership/retention evidence');
 const correlated=correlate(inventory,analytics,objects);
 const previewMap=new Map();
 for(const row of ownership.rows){
  if(typeof row.branch!=='string'||!row.branch)continue;
  const key='autolearnpro-app_'+row.branch+'_TorqueMindRateLimitCounter';
  if(!previewMap.has(key))previewMap.set(key,[]);
  previewMap.get(key).push(row);
 }
 const retainMap=new Map(retention.rows.map(r=>[r.preview_id,r]));
 const rows=correlated.rows.map(n=>{
  const matches=previewMap.get(n.name)||[];
  const candidate=matches.length===1?matches[0]:null;
  const retentionMatch=candidate?retainMap.get(candidate.builds_preview_id):null;
  const permanent=baseWorkers.has(n.script)&&baseWorkers.has(n.name.replace(/_TorqueMindRateLimitCounter$/,''));
  const evidence=permanent?'permanent_worker_namespace':matches.length>1?'ambiguous_name_match':candidate?'heuristic_branch_name_match':'no_preview_identity_join';
  return {...n,worker_namespace_class:permanent?'permanent':'historical_or_preview',
   preview_match:evidence,preview_id:candidate?.builds_preview_id||null,
   preview_decision:candidate?.decision||null,retention_decision:retentionMatch?.decision||null,
   binding_dependency:'not_independently_verified',storage_dependency:n.has_stored_data===true?'stored_data_observed':'not_fully_verified',
   assessment:permanent?'protected_permanent':n.has_stored_data===true?'protected_stored_data':'requires_independent_dependency_evidence',
   deletion_authorized:false};
 });
 const summary={namespaces:rows.length,permanent:rows.filter(r=>r.worker_namespace_class==='permanent').length,
  heuristic_preview_matches:rows.filter(r=>r.preview_match==='heuristic_branch_name_match').length,
  unmatched:rows.filter(r=>r.preview_match==='no_preview_identity_join').length,
  confirmed_stored_data:rows.filter(r=>r.has_stored_data===true).length,
  incomplete_object_evidence:rows.filter(r=>r.object_evidence_status!=='complete').length,authorized_deletions:0};
 return {read_only:true,deletion_authorized:false,summary,rows,note:'Namespace and preview IDs are distinct. A name-based candidate match cannot establish ownership or deletion eligibility.'};
}
function main(){
 const [,,inv,req,obj,own,ret,out]=process.argv;
 if(!out)throw Error('Usage: node scripts/verify-do-preview-dependencies.js INVENTORY.json REQUESTS.csv OBJECTS.json OWNERSHIP.json RETENTION.json OUTPUT.json');
 const j=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const result=verify(j(inv),parseCsv(fs.readFileSync(req,'utf8')),j(obj),j(own),j(ret));
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={verify};
