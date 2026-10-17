'use strict';
const fs=require('node:fs'),path=require('node:path');
const {jsonc}=require('./audit-worker-config-contract');
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
function verify(root){
 const errors=[], warnings=[];
 const app=jsonc(read(root,'wrangler.app.jsonc'));
 const normal=app.durable_objects?.bindings||[];
 const preview=app.previews?.durable_objects?.bindings||[];
 const rate=normal.find(x=>x.name==='TORQUEMIND_RATE_LIMITER');
 const pRate=preview.find(x=>x.name==='TORQUEMIND_RATE_LIMITER');
 if(!rate||rate.class_name!=='TorqueMindRateLimitCounter')errors.push('App production rate-limit binding absent or changed');
 if(!pRate||pRate.class_name!==rate?.class_name)errors.push('Preview rate limiter must use explicit same-class binding');
 if(!app.exports?.TorqueMindRateLimitCounter||app.exports.TorqueMindRateLimitCounter.type!=='durable-object')errors.push('DO class export contract missing');
 if(app.migrations?.some(x=>x.deleted_classes?.includes('TorqueMindRateLimitCounter')))errors.push('Destructive migration detected');
 if(app.previews?.vars?.SEMANTIC_SCHOLAR_ENABLED!=='false')errors.push('Preview Semantic Scholar must remain disabled');
 if(app.env?.staging?.vars?.SEMANTIC_SCHOLAR_ENABLED!=='false')errors.push('Staging Semantic Scholar must remain disabled');
 if(app.vars?.SEMANTIC_SCHOLAR_ENABLED!=='true')errors.push('Production Semantic Scholar policy changed; review required');
 const reconciliation=read(root,'scripts/reconcile-cloudflare-previews.js');
 if(!reconciliation.includes("if(apply)throw Error('Deletion disabled:"))errors.push('Scheduled reconciliation no longer blocks deletion');
 const workflow=read(root,'.github/workflows/cloudflare-preview-reconciliation.yml');
 if(!workflow.includes('scripts/reconcile-cloudflare-previews.js'))errors.push('Preview reconciliation workflow missing');
 if(!workflow.includes('schedule:'))warnings.push('Scheduled reconciliation missing');
 const cleanup=read(root,'.github/workflows/cloudflare-preview-cleanup.yml');
 if(!cleanup.includes('DELETE-OBSOLETE-PREVIEW')||!cleanup.includes('environment: cloudflare-preview-cleanup'))errors.push('Manual deletion approval protections changed');
 return {pass:errors.length===0,errors,warnings,read_only:true,deletion_authorized:false,checked_at:new Date().toISOString(),
  contract:{worker:app.name,production_binding:rate?.name||null,preview_binding:pRate?.name||null,
    class_name:pRate?.class_name||null,preview_semantic_scholar_enabled:app.previews?.vars?.SEMANTIC_SCHOLAR_ENABLED||null,
    reconciler:'report_only',cleanup:'separate_manual_protected_workflow'}};
}
function main(){const root=process.argv[2]||process.cwd();const output=process.argv[3];const result=verify(root);
 if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')}
 console.log(JSON.stringify({pass:result.pass,errors:result.errors,warnings:result.warnings,contract:result.contract}));
 if(!result.pass)process.exitCode=1;
}
if(require.main===module)try{main()}catch(e){console.error('[preview-contract] '+e.message);process.exitCode=1}
module.exports={verify};
