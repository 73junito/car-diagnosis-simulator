'use strict';
/** GET-only Cloudflare Worker metadata. Whitelist field names; never persist raw API bodies or secret values. */
const fs=require('node:fs'),path=require('node:path');
const NAMES=['autolearnpro-app','autolearnpro-public','autolearnpro-exam','autolearnpro-app-staging','car-diagnosis-simulator','car-diagnosis-simulator-staging'];
function summarize(name,settings){
 if(!settings||!Array.isArray(settings.bindings))throw Error('Missing bindings data');
 const bindings=settings.bindings;
 const sorted=(type)=>bindings.filter(x=>type(x.type)).map(x=>x.name).filter(x=>typeof x==='string').sort();
 const flags={};
 for(const key of ['SEMANTIC_SCHOLAR_ENABLED','USE_DO_RATE_LIMIT','TORQUEMIND_ENVIRONMENT']){
  const b=bindings.find(x=>x.name===key&&x.type==='plain_text');
  // These are allowlisted non-secret feature toggles only.
  if(b&&typeof b.text==='string')flags[key]=b.text;
 }
 return {name,live_source:'cloudflare_workers_settings_GET',live_metadata_complete:true,
  durable_object_bindings:sorted(t=>t==='durable_object_namespace'),
  secrets_store_binding_names:sorted(t=>t==='secrets_store_secret'),
  secret_binding_names:sorted(t=>t==='secret_text'||t==='secret_key'),
  binding_types:bindings.filter(b=>typeof b.name==='string'&&typeof b.type==='string').map(b=>({name:b.name,type:b.type})).sort((a,b)=>a.name.localeCompare(b.name)),
  flags,compatibility_date:settings.compatibility_date||null,
  // Route ownership is not returned by settings; do not manufacture it.
  routes_status:'unverified',routes:undefined};
}
async function collect({account,token,fetchImpl=fetch,names=NAMES}){
 if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Cloudflare credentials missing');
 const workers=[],errors=[];
 for(const name of names){
  try{
   const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+encodeURIComponent(name)+'/settings';
   const r=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const body=await r.json();
   if(body.success!==true)throw Error('Unsuccessful Cloudflare API envelope');
   workers.push(summarize(name,body.result));
  }catch(e){errors.push({name,reason:String(e.message).slice(0,80)})}
 }
 return {read_only:true,deletion_authorized:false,collected_at:new Date().toISOString(),total_targeted:names.length,
   completed:workers.length,failed:errors.length,workers,errors,
   notice:'Routes require separate independent verification. Secret values are never retained. Missing bindings are not proof of absent environment secrets.'};
}
async function main(){
 const output=process.argv[2];if(!output)throw Error('Usage: node scripts/collect-live-worker-metadata.js OUTPUT.json');
 const report=await collect({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN});
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({targeted:report.total_targeted,completed:report.completed,failed:report.failed,errors:report.errors}));
 if(report.failed)process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error('[live-metadata] '+e.message);process.exitCode=1});
module.exports={summarize,collect,NAMES};
