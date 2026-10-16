"use strict";
// Read-only PR smoke gate: pending superseded runs never count as successful evidence.
const https=require("node:https");
function latestForPr(runs,pr){
 return runs.filter(r=>r.event==="pull_request"&&(r.pull_requests||[]).some(p=>p.number===pr))
 .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)||b.id-a.id)[0]||null;
}
function verdict(run){
 if(!run)return {ok:false,message:"No smoke run found for this PR"};
 if(run.status!=="completed")return {ok:false,message:"Latest smoke run is "+run.status+" ("+run.id+")"};
 if(run.conclusion!=="success")return {ok:false,message:"Latest smoke run concluded "+run.conclusion+" ("+run.id+")"};
 return {ok:true,message:"Latest smoke run passed ("+run.id+")"};
}
function request(url,token){return new Promise((resolve,reject)=>{
 const req=https.get(url,{headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","User-Agent":"autolearnpro-ci-smoke-verifier","X-GitHub-Api-Version":"2022-11-28"}},res=>{
 let data="";res.setEncoding("utf8");res.on("data",s=>data+=s);res.on("end",()=>{
 if(res.statusCode<200||res.statusCode>=300)return reject(Error("GitHub API HTTP "+res.statusCode));
 try{resolve(JSON.parse(data))}catch(e){reject(e)}
 });});req.on("error",reject);
});}
async function main(){
 const pr=Number(process.argv[2]),repo=process.env.GITHUB_REPOSITORY||"73junito/car-diagnosis-simulator",token=process.env.GITHUB_TOKEN;
 if(!Number.isSafeInteger(pr)||pr<=0||!token||!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error("Usage: GITHUB_TOKEN=... node scripts/check-latest-staging-smoke.js <PR number>");
 const data=await request("https://api.github.com/repos/"+repo+"/actions/workflows/smoke.yml/runs?event=pull_request&per_page=100",token);
 const result=verdict(latestForPr(data.workflow_runs||[],pr));
 console.log((result.ok?"[PASS] ":"[HOLD] ")+result.message);
 if(!result.ok)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error("[HOLD]",e.message);process.exitCode=1});
module.exports={latestForPr,verdict};
