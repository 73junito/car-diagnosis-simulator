"use strict";
const fs=require("node:fs");
const path=require("node:path");
const DOMAINS=["Software engineering","Security and data integrity","Automotive and educational quality","Institutional operations"];
const IDS=["architecture-modularity","automated-test-coverage","solver-correctness","cross-platform-compatibility","security-design","evidence-provenance","authentication-reliability","database-integration","multi-tenant-lifecycle-isolation","data-governance-retention","engineering-model-fidelity","educational-assessment-integrity","ai-grounding-reliability","accessibility-inclusive-learning","deployment-operations","supply-chain-security","versioning-reproducibility","institutional-scalability"];
function validate(c){
 const errors=[];
 if(!c||c.schemaVersion!==1||c.releasePolicy!=="gated-not-scored"||!Array.isArray(c.dimensions))return ["Invalid robustness catalog"];
 if(JSON.stringify(c.domains)!==JSON.stringify(DOMAINS))errors.push("Invalid domain list");
 const seen=new Set();
 for(const d of c.dimensions){
  if(!d||typeof d.id!=="string"||!IDS.includes(d.id)||seen.has(d.id)){errors.push("Unknown or duplicate dimension");continue}
  seen.add(d.id);
  if(!DOMAINS.includes(d.domain))errors.push(d.id+": invalid domain");
  if(!["P0","P1","P2"].includes(d.priority))errors.push(d.id+": invalid priority");
  if(typeof d.acceptance!=="string"||d.acceptance.length<25)errors.push(d.id+": missing acceptance test");
  if(typeof d.reviewerRole!=="string"||!d.reviewerRole.trim())errors.push(d.id+": missing reviewer role");
  if(!["planned","active","not-applicable"].includes(d.applicability))errors.push(d.id+": invalid applicability");
  if(!["not-evaluated","pending","passed","failed"].includes(d.status))errors.push(d.id+": invalid status");
  if(d.status==="passed"&&(d.applicability!=="active"||!d.evidence||!/^https:\/\//.test(d.evidence)))errors.push(d.id+": unproven pass");
  if(d.applicability==="not-applicable"&&d.status==="passed")errors.push(d.id+": not-applicable cannot pass");
 }
 for(const id of IDS)if(!seen.has(id))errors.push("Missing dimension: "+id);
 return errors;
}
if(require.main===module){
 const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../data/lmf/robustness-catalog.json"),"utf8"));
 const errors=validate(c);
 if(errors.length){console.error(errors.join("\n"));process.exitCode=1}
 else console.log("Validated 18 robustness dimensions; statuses are informational, not release authorization.");
}
module.exports={validate,IDS,DOMAINS};
