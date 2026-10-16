'use strict';
const https = require('node:https');
const worker = 'autolearnpro-app';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const requested = process.env.LIVE_PREVIEW_SAMPLE_SIZE || 'all';
const maxRecords = 3000;
function api(url) {
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{Authorization:'Bearer '+token,'User-Agent':'autolearnpro-preview-audit',Accept:'application/json'}},res=>{
   let raw='';res.on('data',b=>{raw+=b;if(raw.length>5000000)req.destroy(Error('Response too large'))});
   res.on('end',()=>{try{resolve({status:res.statusCode,json:JSON.parse(raw)})}catch{reject(Error('Invalid response JSON'))}});
  });req.setTimeout(15000,()=>req.destroy(Error('Preview API timeout')));req.on('error',reject);
 });
}
function interpret(status,response) {
 if(status===404&&Array.isArray(response?.errors)&&response.errors.some(e=>e.code===10025))return 'absent';
 if(status!==200||response?.success!==true||!response.result||typeof response.result!=='object')return 'unknown';
 return 'present_by_name_lookup';
}
async function inventory(tag) {
 const records=[];
 for(let page=1;page<=30;page++){
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/workers/'+tag+'/previews?per_page=100&page='+page;
  const response=await api(url);
  if(response.status!==200||response.json.success!==true||!Array.isArray(response.json.result))throw Error('Builds inventory unavailable');
  records.push(...response.json.result);
  if(records.length>maxRecords)throw Error('Inventory exceeds safety cap');
  if(response.json.result_info?.total_pages&&page>=response.json.result_info.total_pages)return records;
  if(!response.json.result_info?.total_pages&&response.json.result.length<100)return records;
 }
 throw Error('Inventory pagination safety cap reached');
}
async function run(){
 if(!account||!token)throw Error('Cloudflare credentials missing');
 const scripts=await api('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts');
 if(scripts.status!==200||scripts.json.success!==true||!Array.isArray(scripts.json.result))throw Error('Worker inventory failed');
 const matches=scripts.json.result.filter(x=>x.id===worker);
 if(matches.length!==1||!matches[0].tag)throw Error('Worker tag missing or ambiguous');
 const builds=await inventory(matches[0].tag);
 if(builds.some(p=>typeof p.branch!=='string'||!p.branch||typeof p.preview_id!=='string'||!p.preview_id))throw Error('Invalid Builds preview identity');
 if(new Set(builds.map(p=>p.preview_id)).size!==builds.length)throw Error('Duplicate Builds preview IDs');
 const full=requested==='all';
 const n=full?builds.length:Number(requested);
 if(!Number.isSafeInteger(n)||n<1||n>maxRecords)throw Error('Invalid requested audit size');
 const selected=builds.slice(0,n);
 const rows=[];
 for(let i=0;i<selected.length;i+=5){
  const batch=selected.slice(i,i+5);
  const result=await Promise.all(batch.map(async p=>{
   const branch=p.branch.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,128);
   const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/workers/'+worker+'/previews/'+encodeURIComponent(branch);
   try{
    const answer=await api(url);
    return {branch,builds_preview_id:p.preview_id,http:answer.status,live_status:interpret(answer.status,answer.json),errors:(answer.json.errors||[]).map(e=>e.code)};
   }catch{return {branch,builds_preview_id:p.preview_id,http:null,live_status:'unknown',errors:['request_failed']}}
  }));
  rows.push(...result);
 }
 const counts={present_by_name_lookup:0,absent:0,unknown:0};for(const row of rows)counts[row.live_status]++;
 console.log(JSON.stringify({worker,readOnly:true,buildsTotal:builds.length,scanned:rows.length,complete:rows.length===builds.length,counts,rows},null,2));
 if(process.env.GITHUB_STEP_SUMMARY)require('node:fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Live Worker Preview Audit\n\nBuilds records: '+builds.length+'; scanned: '+rows.length+'; complete: '+(rows.length===builds.length)+'; name-lookup present: '+counts.present_by_name_lookup+'; absent: '+counts.absent+'; unknown: '+counts.unknown+'. No deletions.\n');
 if(counts.unknown)process.exitCode=2;
}
if(require.main===module)run().catch(e=>{console.error('Read-only preview audit failed:',e.message);process.exitCode=1});
module.exports={interpret};
