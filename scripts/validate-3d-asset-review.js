"use strict";
const fs=require("node:fs");
const PRIORITIES=["silhouette_proportions","connectors_terminals_mounting","materials_lighting","cutaways_separation","surface_detail_textures"];
function validate(review){
 const errors=[];
 if(!review||typeof review!=="object"||Array.isArray(review))return {valid:false,publishable:false,errors:["review object required"]};
 if(review.schemaVersion!=="1.0.0")errors.push("schemaVersion must be 1.0.0");
 if(typeof review.assetId!=="string"||!review.assetId.trim())errors.push("assetId required");
 if(review.purpose!=="review-only"&&review.purpose!=="publication-candidate")errors.push("invalid purpose");
 const criteria=review.criteria||{};
 for(const key of PRIORITIES){
  const item=criteria[key];
  if(!item||!["pass","fail","pending"].includes(item.status))errors.push(key+": status must be pass, fail, or pending");
  if(!item||typeof item.evidence!=="string"||!item.evidence.trim())errors.push(key+": evidence required");
 }
 const reviewers=review.reviewers||{};
 for(const key of PRIORITIES.slice(0,2)){
  if(criteria[key]?.status==="pass"&&(!reviewers[key]||!/^(?!pending\b).{3,}$/i.test(reviewers[key].trim())))errors.push(key+": actual technical reviewer required for pass");
 }
 if(review.publicationApproved!==false&&review.publicationApproved!==true)errors.push("publicationApproved must be boolean");
 const mandatory=PRIORITIES.slice(0,2).every(key=>criteria[key]?.status==="pass"&&typeof reviewers[key]==="string"&&reviewers[key].trim());
 const all=PRIORITIES.every(key=>criteria[key]?.status==="pass");
 const publishable=errors.length===0&&mandatory&&all&&review.publicationApproved===true&&review.purpose==="publication-candidate";
 return {valid:errors.length===0,publishable:Boolean(publishable),mandatoryPassed:Boolean(mandatory),errors};
}
function main(){
 const path=process.argv[2];
 if(!path)throw Error("Usage: node scripts/validate-3d-asset-review.js review.json");
 const report=validate(JSON.parse(fs.readFileSync(path,"utf8")));
 console.log(JSON.stringify(report,null,2));
 if(!report.valid||!report.publishable)process.exitCode=1;
}
if(require.main===module){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={validate,PRIORITIES};
