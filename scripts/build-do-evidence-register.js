'use strict';
const fs=require('node:fs'),path=require('node:path');
const {assertInventory}=require('./collect-do-object-evidence');
function build(invPayload,dependencies,bindings,batches){
 const inventory=assertInventory(invPayload);
 if(!dependencies?.read_only||dependencies.deletion_authorized!==false||!Array.isArray(dependencies.rows)||dependencies.rows.length!==inventory.namespaces.length)throw Error('Incomplete dependency evidence');
 if(!bindings?.read_only||bindings.deletion_authorized!==false||bindings.summary?.workers!==6||!Array.isArray(bindings.rows))throw Error('Incomplete live-binding evidence');
 if(!Array.isArray(batches))throw Error('Batches must be an array');
 const observed=new Map(),conflicts=new Set();
 for(const batch of batches){
  const ev=batch?.evidence||batch;
  const entries=ev?.namespaces||ev?.entries;
  if(ev?.read_only!==true||ev.deletion_authorized!==false||!Array.isArray(entries)||!Array.isArray(ev.failures))throw Error('Untrusted inspection batch');
  for(const o of entries){
   if(typeof o.name!=='string'||o.object_enumeration_complete!==true)throw Error('Incomplete object inspection');
   const old=observed.get(o.name);
   if(old&&(old.object_count!==o.object_count||old.has_stored_data!==o.has_stored_data))conflicts.add(o.name);
   observed.set(o.name,o);
  }
 }
 const deps=new Map(dependencies.rows.map(r=>[r.namespace_id,r]));
 const live=new Map();
 for(const b of bindings.rows){if(b.namespace_id)live.set(b.namespace_id,b.worker)}
 const rows=inventory.namespaces.map(n=>{
  const dep=deps.get(n.id);if(!dep)throw Error('Missing namespace dependency row');
  const storage=observed.get(n.name);
  const conflict=conflicts.has(n.name);
  const stored=storage?.has_stored_data===true||dep.has_stored_data===true;
  return {namespace_id:n.id,namespace_name:n.name,script:n.script,class_name:n.class,sqlite:n.use_sqlite===true,
   current_worker_binding:live.get(n.id)||null,preview_association:dep.preview_match||'unverified',
   request_status:dep.requests_status||'unknown',requests_30d:dep.requests_30d??null,
   object_evidence:conflict?'conflicting_snapshots':storage?'complete':dep.object_evidence_status||'not_collected',
   stored_data:stored?'observed':storage?.has_stored_data===false?'not_observed_in_sample':'unknown',
   investigation_priority:live.has(n.id)?'protect_live_binding':stored?'protect_stored_data':conflict?'investigate_conflict':!storage?'inspect_storage':'verify_preview_ownership',
   deletion_authorized:false};
 });
 const counts={};for(const row of rows)counts[row.investigation_priority]=(counts[row.investigation_priority]||0)+1;
 return {read_only:true,deletion_authorized:false,summary:{namespaces:rows.length,completed_current_batches:rows.filter(r=>observed.has(r.namespace_name)).length,conflicting_names:conflicts.size,priority_counts:counts,authorized_deletions:0},rows};
}
function main(){const [,,inv,dep,binding,out,...batchPaths]=process.argv;if(!out||!batchPaths.length)throw Error('Usage: node scripts/build-do-evidence-register.js INVENTORY DEPENDENCIES BINDINGS OUTPUT BATCH...');const j=p=>JSON.parse(fs.readFileSync(p,'utf8'));const result=build(j(inv),j(dep),j(binding),batchPaths.map(j));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary))}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={build};
