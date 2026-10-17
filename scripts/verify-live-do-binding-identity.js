'use strict';
const fs=require('node:fs'),path=require('node:path');
const WORKERS=['autolearnpro-app','autolearnpro-app-staging','autolearnpro-public','autolearnpro-exam','car-diagnosis-simulator','car-diagnosis-simulator-staging'];
const id=x=>typeof x==='string'&&/^[0-9a-f]{32}$/i.test(x);
function reconcile(inventory,observations){
 const inv=inventory?.inventory||inventory;
 if(!inv?.pagination?.complete||!Array.isArray(inv.namespaces)||inv.total_namespaces!==inv.namespaces.length)throw Error('Incomplete namespace inventory');
 if(!Array.isArray(observations)||observations.length!==WORKERS.length)throw Error('Incomplete six-Worker evidence');
 const byId=new Map(inv.namespaces.map(n=>[n.id,n]));
 if(byId.size!==inv.namespaces.length)throw Error('Duplicate namespace inventory ID');
 const seen=new Set(),rows=[];
 for(const x of observations){
  if(!WORKERS.includes(x.worker)||seen.has(x.worker))throw Error('Invalid/duplicate Worker');
  seen.add(x.worker);
  if(x.status!=='complete'||!Array.isArray(x.bindings))throw Error('Unverified Worker settings');
  const bindings=x.bindings.filter(b=>b.name==='TORQUEMIND_RATE_LIMITER');
  if(bindings.length>1)throw Error('Duplicate rate-limit binding');
  if(bindings.length===0){rows.push({worker:x.worker,status:'no_live_rate_limit_binding',namespace_id:null,deletion_authorized:false});continue}
  const b=bindings[0];if(!id(b.namespace_id)||b.class_name!=='TorqueMindRateLimitCounter')throw Error('Invalid live DO binding identity');
  const match=byId.get(b.namespace_id);
  rows.push({worker:x.worker,namespace_id:b.namespace_id,namespace_name:match?.name||null,
   class_name:b.class_name,status:match&&match.class==='TorqueMindRateLimitCounter'?'verified_id_in_inventory':'live_id_not_confirmed_in_inventory',deletion_authorized:false});
 }
 return {read_only:true,deletion_authorized:false,summary:{workers:rows.length,confirmed:rows.filter(x=>x.status==='verified_id_in_inventory').length,unmatched:rows.filter(x=>x.status==='live_id_not_confirmed_in_inventory').length,no_binding:rows.filter(x=>x.status==='no_live_rate_limit_binding').length},rows};
}
async function collect({account,token,fetchImpl=fetch}){
 if(!id(account)||!token)throw Error('Missing credentials');
 const records=[];
 for(const worker of WORKERS){
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+encodeURIComponent(worker)+'/settings';
  const resp=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(!resp.ok)throw Error('Settings request failed for '+worker+' HTTP '+resp.status);
  const body=await resp.json();if(body.success!==true||!Array.isArray(body.result?.bindings))throw Error('Incomplete settings for '+worker);
  records.push({worker,status:'complete',bindings:body.result.bindings.filter(b=>b.type==='durable_object_namespace').map(b=>({name:b.name,class_name:b.class_name,namespace_id:b.namespace_id}))});
 }
 return records;
}
async function main(){const [,,invPath,out]=process.argv;if(!out)throw Error('Usage: node scripts/verify-live-do-binding-identity.js INVENTORY.json OUTPUT.json');const obs=await collect({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN});const result=reconcile(JSON.parse(fs.readFileSync(invPath,'utf8')),obs);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary))}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={collect,reconcile,WORKERS};
