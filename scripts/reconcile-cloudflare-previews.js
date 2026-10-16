'use strict';
const https = require('node:https');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const repo = process.env.GITHUB_REPOSITORY || '73junito/car-diagnosis-simulator';
const worker = 'autolearnpro-app';
const apply = process.env.PREVIEW_CLEANUP_APPLY === 'true';
const approvedIds = new Set((process.env.PREVIEW_APPROVED_IDS || '').split(',').map(x=>x.trim()).filter(Boolean));
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const githubToken = process.env.GITHUB_TOKEN;
function request(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {headers:{'Authorization':'Bearer '+token,'User-Agent':'autolearnpro-preview-reconciler','Accept':'application/json'}},res=>{
      let raw='';res.on('data',b=>raw+=b);res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300){let code='unknown';try{const data=JSON.parse(raw);code=(data.errors||[]).map(e=>String(e.code)+':'+String(e.message).slice(0,120)).join(';')}catch{}return reject(new Error('HTTP '+res.statusCode+' for '+new URL(url).pathname+' Cloudflare='+code));}
        try{resolve(JSON.parse(raw))}catch(e){reject(e)}
      });
    });req.on('error',reject);
  });
}
function safeName(branch) { return branch.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,128); }
function classify(preview, prs) {
 if (!preview || typeof preview.branch !== 'string' || !preview.branch ||
     typeof preview.preview_id !== 'string' || !/^[a-z0-9-]{8,}$/i.test(preview.preview_id)) {
   return {action:'retain',reason:'invalid_preview_identity'};
 }
 const matches = prs.filter(pr=>safeName(pr.head.ref)===safeName(preview.branch));
 if (!matches.length) return {action:'retain',reason:'no_matching_pr'};
 if (matches.some(pr=>pr.state==='open')) return {action:'retain',reason:'active_pr'};
 if (matches.some(pr=>pr.head.repo?.full_name!==repo)) return {action:'retain',reason:'fork_or_unknown_owner'};
 if (matches.length!==1) return {action:'retain',reason:'ambiguous_reused_branch'};
 const pr=matches[0];
 if (!pr.merged_at) return {action:'retain',reason:'closed_unmerged_pr'};
 return {action:'candidate',reason:'merged_pr',pr:pr.number};
}

async function allPages(url,token,extract,maxPages=30){
 const items=[];
 for(let page=1;page<=maxPages;page++){
  const sep=url.includes('?')?'&':'?'; const data=await request(url+sep+'per_page=100&page='+page,token);
  const arr=extract(data);if(!Array.isArray(arr))throw Error('Unrecognized API listing format');
  items.push(...arr);
  if(data.result_info?.total_pages){if(page>=data.result_info.total_pages)return items;}
  else if(arr.length<100)return items;
 }
 throw Error('Pagination safety cap reached; no deletions');
}
async function main(){
 if(!apiToken||!account||!githubToken)throw Error('Cloudflare/GitHub credentials missing');
 const prs=await allPages('https://api.github.com/repos/'+repo+'/pulls?state=all',githubToken,x=>x,50);
 const scripts=await request('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts',apiToken);
 if(scripts.success!==true||!Array.isArray(scripts.result))throw Error('Worker inventory unavailable');
 const targets=scripts.result.filter(x=>x.id===worker);
 if(targets.length!==1||!/^[a-f0-9]{32}$/i.test(targets[0].tag||''))throw Error('Worker tag missing or ambiguous');
 const previews=await allPages('https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/workers/'+targets[0].tag+'/previews',apiToken,x=>{
   if(x.success!==true)throw Error('Cloudflare listing not successful');
   return x.result;
 });
 if(previews.some(p=>typeof p.branch!=='string'||!p.branch||typeof p.preview_id!=='string'||!p.preview_id)){
  const fields=Object.keys(previews[0]||{}).sort().join(',');
  throw Error('Cloudflare preview response missing branch or preview_id. Available keys: '+fields);
 }
 const rows=previews.map(p=>({name:safeName(p.branch),preview_id:p.preview_id,...classify(p,prs)}));
 const candidates=rows.filter(r=>r.action==='candidate');
 console.log(JSON.stringify({worker,dryRun:!apply,total:rows.length,candidates:candidates.length,rows},null,2));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## Cloudflare Preview Reconciliation\n\n'+rows.length+' previews checked, '+candidates.length+' merged-PR Builds records (not verified live previews). Mode: '+(apply?'apply':'dry run')+'.\n');
 if(apply)throw Error('Deletion disabled: Builds inventory does not verify live Worker previews');
}
if(require.main===module)main().catch(e=>{console.error('Preview reconciliation stopped:',e.message);process.exitCode=1});
module.exports={safeName,classify};
