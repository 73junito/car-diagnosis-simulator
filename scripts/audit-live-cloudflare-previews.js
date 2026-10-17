'use strict';
const https = require('node:https');
const {reconcile: reconcileOwnership} = require('./preview-pr-ownership');
const worker = 'autolearnpro-app';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;
const requested = process.env.LIVE_PREVIEW_SAMPLE_SIZE || 'all';
const maxRecords = 3000;
function api(url, auth = token) {
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{Authorization:'Bearer '+auth,'User-Agent':'autolearnpro-preview-audit',Accept:'application/json'}},res=>{
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
function safeName(value){return value.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,128);}
function correlate(p,live,prs){
 const name=safeName(p.branch);
 const matches=prs.filter(pr=>pr.head && typeof pr.head.ref==='string' && safeName(pr.head.ref)===name);
 if(!live||live.live_status!=='present_by_name_lookup')return {review:'not_live_or_uncertain',identity:'unverified'};
 if(matches.length!==1)return {review:'protected_ambiguous_pr',identity:'unverified'};
 const pr=matches[0];
 if(pr.state!=='closed'||!pr.merged_at||pr.head.repo?.full_name!=='73junito/car-diagnosis-simulator')return {review:'protected_pr_lifecycle',identity:'unverified'};
 const result=live.result;
 const returnedId=result?.preview_id||result?.id;
 const identity=typeof returnedId==='string'&&returnedId===p.preview_id?'verified':'unverified';
 return {review:identity==='verified'?'reviewable_merged_live':'needs_identity_confirmation',identity,pr:pr.number};
}
const retentionDays=30;
function eligibility(row, prs, now = new Date()) {
 if(row.review!=='reviewable_merged_live'||row.identity!=='verified'||row.live_status!=='present_by_name_lookup')
  return {eligibility:'protected',reason:row.review};
 const matches=prs.filter(pr=>pr.number===row.pr);
 if(matches.length!==1||matches[0].state!=='closed'||!matches[0].merged_at)
  return {eligibility:'protected',reason:'pr_not_uniquely_merged'};
 const mergedAt=new Date(matches[0].merged_at);
 if(!Number.isFinite(mergedAt.getTime())||!Number.isFinite(now.getTime())||mergedAt.getTime()>now.getTime())
  return {eligibility:'protected',reason:'invalid_merge_timestamp'};
 const ageDays=(now.getTime()-mergedAt.getTime())/86400000;
 if(ageDays<retentionDays)return {eligibility:'retained',reason:'within_30_day_retention',merged_at:mergedAt.toISOString(),age_days:Math.floor(ageDays)};
 return {eligibility:'review_required',reason:'past_30_days_not_approved',merged_at:mergedAt.toISOString(),age_days:Math.floor(ageDays)};
}
async function allPulls(){
 const prs=[];
 for(let page=1;page<=50;page++){
  const result=await api('https://api.github.com/repos/73junito/car-diagnosis-simulator/pulls?state=all&per_page=100&page='+page,githubToken);
  if(result.status!==200||!Array.isArray(result.json))throw Error('GitHub PR inventory failed');
  prs.push(...result.json);
  if(result.json.length<100)return prs;
 }
 throw Error('GitHub PR pagination cap reached');
}
async function run(){
 if(!account||!token||!githubToken)throw Error('Cloudflare/GitHub credentials missing');
 const prs=await allPulls();
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
    const live={live_status:interpret(answer.status,answer.json),result:answer.json.result};
    return {branch,builds_preview_id:p.preview_id,http:answer.status,live_status:live.live_status,...correlate(p,live,prs),errors:(answer.json.errors||[]).map(e=>e.code)};
   }catch{return {branch,builds_preview_id:p.preview_id,http:null,live_status:'unknown',...correlate(p,null,prs),errors:['request_failed']}}
  }));
  rows.push(...result);
 }
 const assessedAt=new Date();
 const manifest=rows.map(row=>({...row,...eligibility(row,prs,assessedAt)}));
 const ownershipReport=manifest.length===builds.length?reconcileOwnership({worker,readOnly:true,complete:manifest.length===builds.length,scanned:manifest.length,buildsTotal:builds.length,created_at:assessedAt.toISOString(),rows:manifest},prs):null;
 const eligibleCounts={};for(const row of manifest)eligibleCounts[row.eligibility]=(eligibleCounts[row.eligibility]||0)+1;
 const counts={present_by_name_lookup:0,absent:0,unknown:0};for(const row of rows)counts[row.live_status]++;
 const reviews={};for(const row of rows)reviews[row.review]=(reviews[row.review]||0)+1;
 console.log(JSON.stringify({worker,readOnly:true,buildsTotal:builds.length,scanned:rows.length,complete:rows.length===builds.length,counts,reviews,retentionDays,eligibleCounts,rows:manifest},null,2));
 if(process.env.GITHUB_WORKSPACE){const fs=require('node:fs');const path=require('node:path');const out=path.join(process.env.GITHUB_WORKSPACE,'cloudflare-preview-eligibility-manifest.json');fs.writeFileSync(out,JSON.stringify({created_at:assessedAt.toISOString(),worker,readOnly:true,retentionDays,buildsTotal:builds.length,scanned:manifest.length,complete:manifest.length===builds.length,eligibleCounts,rows:manifest},null,2)+'\n');}
 if(process.env.GITHUB_WORKSPACE && ownershipReport){const fs=require('node:fs');const path=require('node:path');fs.writeFileSync(path.join(process.env.GITHUB_WORKSPACE,'cloudflare-preview-pr-ownership.json'),JSON.stringify(ownershipReport,null,2)+'\n');}
 if(process.env.GITHUB_STEP_SUMMARY)require('node:fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Live Worker Preview Audit\n\nBuilds records: '+builds.length+'; scanned: '+rows.length+'; complete: '+(rows.length===builds.length)+'; name-lookup present: '+counts.present_by_name_lookup+'; absent: '+counts.absent+'; unknown: '+counts.unknown+'. No deletions.\n');
 if(counts.unknown)process.exitCode=2;
}
if(require.main===module)run().catch(e=>{console.error('Read-only preview audit failed:',e.message);process.exitCode=1});
module.exports={interpret,correlate,eligibility};
