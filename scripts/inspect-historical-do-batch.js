'use strict';
const fs=require('node:fs'),path=require('node:path');
const {assertInventory,inspectNamespace}=require('./collect-do-object-evidence');
const {verify}=require('./verify-do-preview-dependencies');
const {parseCsv}=require('./correlate-do-usage-evidence');
const {reconcile}=require('./verify-live-do-binding-identity');
function select(inventory, dependency, liveBindings, limit=10){
 const inv=assertInventory(inventory);
 if(!Number.isInteger(limit)||limit<1||limit>25)throw Error('Inspection batch bound must be 1-25');
 if(!dependency?.read_only||dependency.deletion_authorized!==false||!Array.isArray(dependency.rows)||dependency.rows.length!==inv.namespaces.length)throw Error('Incomplete dependency report');
 if(!liveBindings?.read_only||liveBindings.deletion_authorized!==false||!Array.isArray(liveBindings.rows)||liveBindings.summary?.workers!==6)throw Error('Incomplete live Worker binding evidence');
 const pinned=new Set(liveBindings.rows.map(r=>r.namespace_id).filter(Boolean));
 const byId=new Map(inv.namespaces.map(n=>[n.id,n]));
 const rows=dependency.rows.filter(r=>byId.has(r.namespace_id)&&!pinned.has(r.namespace_id)&&r.object_evidence_status!=='complete');
 rows.sort((a,b)=>{const priority=x=>x.preview_match==='no_preview_identity_join'?0:x.preview_match==='ambiguous_name_match'?1:2;return priority(a)-priority(b)||a.name.localeCompare(b.name)});
 return {read_only:true,deletion_authorized:false,inventory_total:inv.namespaces.length,pinned_live_namespace_ids:pinned.size,
  unresolved_count:rows.length,selected:rows.slice(0,limit).map(r=>({id:r.namespace_id,name:r.name,script:r.script,preview_match:r.preview_match})),
  note:'Selected namespaces remain protected; inspection is read-only and cannot demonstrate deletion eligibility.'};
}
async function inspect(selection,{account,token,fetchImpl=fetch}){
 if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Missing credentials');
 const namespaces=[],failures=[];
 for(const item of selection.selected){
  try{namespaces.push(await inspectNamespace({account,token,namespace:item,fetchImpl}))}
  catch(e){failures.push({name:item.name,reason:String(e.message).slice(0,140)})}
 }
 return {read_only:true,deletion_authorized:false,observed_at:new Date().toISOString(),
  namespaces_attempted:selection.selected.length,namespaces_completed:namespaces.length,namespaces_failed:failures.length,
  namespaces,failures,warning:'A successful object enumeration is not evidence of inactive Worker bindings or deletion eligibility.'};
}
async function main(){const [,,invPath,dependencyPath,bindingPath,outPath,limitArg]=process.argv;
 if(!outPath)throw Error('Usage: node scripts/inspect-historical-do-batch.js INVENTORY DEPENDENCIES LIVE_BINDINGS OUTPUT [LIMIT]');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const selected=select(read(invPath),read(dependencyPath),read(bindingPath),limitArg?Number(limitArg):10);
 const result=await inspect(selected,{account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN});
 fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify({selection:selected,evidence:result},null,2)+'\n');
 console.log(JSON.stringify({unresolved:selected.unresolved_count,attempted:result.namespaces_attempted,completed:result.namespaces_completed,failed:result.namespaces_failed,with_stored_data:result.namespaces.filter(x=>x.has_stored_data).length}));
 if(result.namespaces_failed)process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={select,inspect};
