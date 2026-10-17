'use strict';
// Offline, read-only Worker config contract check. No Cloudflare API calls or secret values.
const fs=require('node:fs'), path=require('node:path');
const TARGETS=[
 {name:'autolearnpro-public',file:'wrangler.jsonc'},
 {name:'autolearnpro-app',file:'wrangler.app.jsonc'},
 {name:'autolearnpro-exam',file:'wrangler.exam.jsonc'},
 {name:'autolearnpro-app-staging',file:'wrangler.app.jsonc',env:'staging'},
 {name:'car-diagnosis-simulator-staging',file:'wrangler.jsonc',env:'staging'},
 {name:'car-diagnosis-simulator',file:null,classification:'legacy_unmanaged'}
];
function jsonc(raw){return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm,'$1').replace(/,\s*([}\]])/g,'$1'))}
const names=xs=>Array.isArray(xs)?xs.map(x=>x.name).sort():[];
function summarize(target, root){
 if(!target.file)return {name:target.name,classification:'legacy_unmanaged',status:'needs_manual_review',reason:'No dedicated Wrangler config in checked sources'};
 const base=jsonc(fs.readFileSync(path.join(root,target.file),'utf8'));
 const sub=target.env?base.env?.[target.env]:null;
 if(target.env&&!sub)throw Error('Missing environment '+target.env);
 const cfg=sub?{...base,...sub}:base;
 if(cfg.name!==target.name)throw Error('Name mismatch '+target.name);
 const bindings=names(cfg.durable_objects?.bindings);
 const secretBindings=Array.isArray(cfg.secrets_store_secrets)?cfg.secrets_store_secrets.map(x=>x.binding).sort():[];
 const flags={};
 for(const key of ['SEMANTIC_SCHOLAR_ENABLED','USE_DO_RATE_LIMIT','TORQUEMIND_ENVIRONMENT'])flags[key]=cfg.vars?.[key]??null;
 return {name:cfg.name,classification:target.env?'staging':'production',status:'configuration_declared',
 config_file:target.file,environment:target.env||'default',routes:(cfg.routes||[]).map(r=>typeof r==='string'?r:r.pattern).sort(),
 asset_directory:cfg.assets?.directory||null,worker_entry:cfg.main||null,workers_dev:cfg.workers_dev??null,
 compatibility_date:cfg.compatibility_date||null,durable_object_bindings:bindings,
 secrets_store_binding_names:secretBindings,flags,
 warnings:[...(target.env&& !sub.secrets_store_secrets && base.secrets_store_secrets?.length ? ['inherited_secret_store_unverified_for_environment']:[])]};
}
function compare(expected,live){
 if(!live)return {status:'live_not_provided',differences:[]};
 if(live.name!==expected.name)throw Error('Live target does not match expected Worker');
 const differences=[];
 for(const field of ['routes','durable_object_bindings','secrets_store_binding_names']){
  if(!Object.hasOwn(live,field))continue;
  const a=JSON.stringify(expected[field]||[]),b=JSON.stringify([...live[field]].sort());
  if(a!==b)differences.push(field);
 }
 for(const [k,v] of Object.entries(expected.flags||{})){
  if(live.flags && Object.hasOwn(live.flags,k) && live.flags[k]!==v)differences.push('flags.'+k);
 }
 const fields=['routes','durable_object_bindings','secrets_store_binding_names']; const missing=fields.filter(f=>!Object.hasOwn(live,f));
 return {status:differences.length?'drift_detected':missing.length?'partial_live_evidence':'provided_fields_match',differences,missing_fields:missing};
}
function audit(root,liveRows=[]){
 if(!Array.isArray(liveRows))throw Error('Live evidence must be array');
 const seen=new Set();
 for(const item of liveRows){if(!item||typeof item.name!=='string'||seen.has(item.name))throw Error('Invalid or duplicate live evidence');seen.add(item.name)}
 return {read_only:true,deletion_authorized:false,checked_at:new Date().toISOString(),
  warning:'Comparison checks only supplied live metadata fields. Missing fields are unverified, not matching. Secret values are never collected.',
  workers:TARGETS.map(t=>{const expected=summarize(t,root);const live=liveRows.find(x=>x.name===t.name);
   return {...expected,live_comparison:expected.classification==='legacy_unmanaged'?{status:'manual_review_required',differences:[]}:compare(expected,live),
    live_evidence_present:!!live};})};
}
function main(){
 const [, ,root=process.cwd(),output,livePath]=process.argv;
 if(!output)throw Error('Usage: node scripts/audit-worker-config-contract.js REPO_ROOT OUTPUT.json [LIVE_METADATA.json]');
 const live=livePath?JSON.parse(fs.readFileSync(livePath,'utf8')):[];
 const report=audit(root,live);fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({total:report.workers.length,declared:report.workers.filter(x=>x.status==='configuration_declared').length,manual_review:report.workers.filter(x=>x.status==='needs_manual_review').length,live_verified:report.workers.filter(x=>x.live_comparison.status==='provided_fields_match').length,live_missing:report.workers.filter(x=>x.live_comparison.status==='live_not_provided').length}));
}
if(require.main===module)try{main()}catch(e){console.error('[config-contract] '+e.message);process.exitCode=1}
module.exports={audit,summarize,compare,jsonc};
