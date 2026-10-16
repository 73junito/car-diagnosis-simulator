"use strict";
const fs=require("node:fs");
const CLASSES=["generic","dimensionally-controlled","manufacturer-specific","statistically-validated","safety-critical"];
const USES=["visual","geometry","manufacturing","specifications","statistical","simulation","assessment","safety"];
function decide(m, request){
 const issues=[];
 if(!m||typeof m!=="object"||m.schemaVersion!=="1.0.0"||!CLASSES.includes(m.reuseClass)||!m.assetId||!m.revision||!m.provenance?.source||!m.scope?.length||!Array.isArray(m.permittedUses))return {decision:"prohibited",reasons:["invalid or incomplete reuse manifest"]};
 if(!request||!USES.includes(request.use)||!request.application||typeof request.application!=="string")return {decision:"prohibited",reasons:["invalid reuse request"]};
 if(!m.permittedUses.every(u=>USES.includes(u)))return {decision:"prohibited",reasons:["unknown permitted use"]};
 if(!m.permittedUses.includes(request.use))return {decision:"prohibited",reasons:["use not permitted"]};
 if(!m.scope.includes(request.application))issues.push("application outside validated scope");
 if(request.sourceRevision!==m.revision)issues.push("source revision must be revalidated");
 const c=m.reuseClass;
 if(c==="generic"&&request.use!=="visual")return {decision:"prohibited",reasons:["generic content is illustrative only"]};
 if(["geometry","manufacturing"].includes(request.use)||c==="dimensionally-controlled"){
  if(request.use!=="visual"&&(!m.dimensions||m.units!=="mm"||!m.toleranceEvidence?.source||m.toleranceEvidence.status!=="verified"||m.fitEvidence?.status!=="verified"))issues.push("dimension, tolerance and mating fit evidence required");
 }
 if(["specifications","simulation","assessment","safety"].includes(request.use)||["manufacturer-specific","safety-critical"].includes(c)){
  const match=m.part?.manufacturer===request.part?.manufacturer&&m.part?.number===request.part?.number&&m.part?.variant===request.part?.variant&&m.part?.datasheetRevision===request.part?.datasheetRevision;
  if(!match||!m.part?.number||!m.part?.datasheetRevision)issues.push("exact manufacturer part, variant and datasheet revision required");
  if(m.operatingConditions?.status!=="verified"||request.operatingConditionsId!==m.operatingConditions?.id)issues.push("verified operating conditions do not match");
 }
 if(request.use==="statistical"||c==="statistically-validated"){
  if(!m.statisticalModel||m.statisticalModel.status!=="validated"||!m.statisticalModel.evidence||request.populationId!==m.statisticalModel.populationId||request.measurementMethodId!==m.statisticalModel.measurementMethodId)issues.push("population, method and statistical evidence must be revalidated");
 }
 if(request.use==="simulation"||request.use==="assessment"){
  if(m.softwareContract?.status!=="verified"||m.softwareContract.regressionStatus!=="passed"||request.contractRevision!==m.softwareContract.revision)issues.push("software contract/regression validation missing");
 }
 if(c==="safety-critical"||request.use==="safety"){
  if(!m.safetyReview||m.safetyReview.status!=="approved"||m.safetyReview.application!==request.application||!m.safetyReview.reviewer)issues.push("application-specific safety approval missing");
 }
 if(m.review?.status!=="approved"||!m.review.reviewer||!m.review.evidence)issues.push("reuse review not approved");
 return issues.length?{decision:"revalidation-required",reasons:issues}:{decision:"approved",reasons:["scope, evidence and approval match"]};
}
function main(){const [source,requestFile]=process.argv.slice(2);if(!source||!requestFile)throw Error("Usage: node scripts/validate-component-reuse.js manifest.json request.json");const out=decide(JSON.parse(fs.readFileSync(source)),JSON.parse(fs.readFileSync(requestFile)));console.log(JSON.stringify(out,null,2));if(out.decision!=="approved")process.exitCode=1}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={decide,CLASSES,USES};
