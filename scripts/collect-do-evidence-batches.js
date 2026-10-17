'use strict';
const fs=require('node:fs'),path=require('node:path');
const {select,inspect}=require('./inspect-historical-do-batch');
const {assertInventory}=require('./collect-do-object-evidence');
async function run({inventory,dependencies,bindings,previous=[],account,token,fetchImpl=fetch,max=25}){
 if(!Number.isInteger(max)||max<1||max>100)throw Error('Total batch limit must be 1-100');
 const inv=assertInventory(inventory);
 const known=new Set();
 if(!Array.isArray(previous)) previous=[previous];
 for(const p of previous){if(p?.evidence?.read_only!==true||p?.evidence?.deletion_authorized!==false)throw Error('Untrusted prior evidence');for(const v of p.evidence.namespaces||[]){if(!v.object_enumeration_complete)continue;const id=inv.namespaces.find(n=>n.name===v.name)?.id;if(id)known.add(id)}}
 const baseline=select(inventory,dependencies,bindings,25);
 const pinned=new Set(bindings.rows.map(r=>r.namespace_id).filter(Boolean));
 const rows=dependencies.rows.filter(r=>!pinned.has(r.namespace_id)&&!known.has(r.namespace_id)&&r.object_evidence_status!=='complete');
 const priority=x=>x.preview_match==='no_preview_identity_join'?0:x.preview_match==='ambiguous_name_match'?1:2;
 rows.sort((a,b)=>priority(a)-priority(b)||a.name.localeCompare(b.name));
 const lookup=new Map(inv.namespaces.map(n=>[n.id,n]));
 const selected=rows.slice(0,max).filter(r=>lookup.has(r.namespace_id)).map(r=>({id:r.namespace_id,name:r.name,script:r.script,preview_match:r.preview_match}));
 const reports=[];
 for(let i=0;i<selected.length;i+=25){reports.push(await inspect({selected:selected.slice(i,i+25)},{account,token,fetchImpl}))}
 const entries=reports.flatMap(r=>r.namespaces),failures=reports.flatMap(r=>r.failures);
 return {read_only:true,deletion_authorized:false,observed_at:new Date().toISOString(),total_inventory:inv.namespaces.length,
  prior_complete:known.size,remaining_before:rows.length,attempted:selected.length,completed:entries.length,failed:failures.length,
  with_stored_data:entries.filter(r=>r.has_stored_data).length,entries,failures,
  warning:'Empty object listing is not zero traffic or absence of dependency. No namespace deletion authorized.'};
}
async function main(){const [,,inv,dep,binding,prior,out,maxArg]=process.argv;if(!out)throw Error('Usage: node scripts/collect-do-evidence-batches.js INVENTORY DEPENDENCIES BINDINGS PREVIOUS.json OUTPUT.json [MAX<=100]');
 const j=p=>JSON.parse(fs.readFileSync(p,'utf8'));const result=await run({inventory:j(inv),dependencies:j(dep),bindings:j(binding),previous:j(prior),account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,max:maxArg?Number(maxArg):25});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({attempted:result.attempted,completed:result.completed,failed:result.failed,with_stored_data:result.with_stored_data,remaining_before:result.remaining_before}));if(result.failed)process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={run};
