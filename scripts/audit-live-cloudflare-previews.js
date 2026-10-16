'use strict';
const https = require('node:https');
const repo = process.env.GITHUB_REPOSITORY || '73junito/car-diagnosis-simulator';
const worker = 'autolearnpro-app';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const gh = process.env.GITHUB_TOKEN;
const limit = Math.min(25, Math.max(1, Number(process.env.LIVE_PREVIEW_SAMPLE_SIZE || 20)));
function api(url, auth) {
 return new Promise((resolve,reject)=>{
  https.get(url,{headers:{Authorization:'Bearer '+auth,'User-Agent':'autolearnpro-preview-audit',Accept:'application/json'}},res=>{
   let raw='';res.on('data',b=>raw+=b);res.on('end',()=>{
    let json;try{json=JSON.parse(raw)}catch{return reject(Error('Invalid response JSON'))}
    resolve({status:res.statusCode,json});
   });
  }).on('error',reject);
 });
}
function interpret(status, response) {
 if(status===404 && Array.isArray(response?.errors) && response.errors.some(e=>e.code===10025))return 'absent';
 if(status!==200 || response?.success!==true || !response.result || typeof response.result!=='object')return 'unknown';
 return 'present_by_name_lookup';
}
async function run(){
 if(!account||!token||!gh)throw Error('Credentials missing');
 const github=await api('https://api.github.com/repos/'+repo+'/pulls?state=closed&per_page=100&sort=updated&direction=desc',gh);
 if(github.status!==200||!Array.isArray(github.json))throw Error('GitHub PR listing failed');
 const scripts=await api('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts',token);
 if(scripts.status!==200||scripts.json.success!==true)throw Error('Worker inventory failed');
 const target=scripts.json.result.find(s=>s.id===worker);
 if(!target||!target.tag)throw Error('Worker tag missing');
 const builds=await api('https://api.cloudflare.com/client/v4/accounts/'+account+'/builds/workers/'+target.tag+'/previews?per_page=100&page=1',token);
 if(builds.status!==200||builds.json.success!==true||!Array.isArray(builds.json.result))throw Error('Builds listing failed');
 const selected=builds.json.result.filter(p=>p.branch&&p.preview_id).slice(0,limit);
 const rows=[];
 for(const p of selected){
  const name=p.branch.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,128);
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/workers/'+worker+'/previews/'+encodeURIComponent(name);
  const answer=await api(url,token);
  const outcome=interpret(answer.status,answer.json,name);
  rows.push({branch:name,builds_preview_id:p.preview_id,http:answer.status,live_status:outcome,errors:(answer.json.errors||[]).map(e=>e.code)});
 }
 const tally={};for(const r of rows)tally[r.live_status]=(tally[r.live_status]||0)+1;
 console.log(JSON.stringify({worker,readOnly:true,sampled:rows.length,counts:tally,rows},null,2));
 if(rows.some(r=>r.live_status==='unknown'))process.exitCode=2;
}
if(require.main===module)run().catch(e=>{console.error('Read-only preview audit failed:',e.message);process.exitCode=1});
module.exports={interpret};
