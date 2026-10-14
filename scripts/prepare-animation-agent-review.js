#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Ajv=require('ajv');
const {validateManifest}=require('./verify-animation-manifests');
const root=path.resolve(__dirname,'..');
const readJson=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const canonicalText=(s)=>s.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
const textHash=(p)=>crypto.createHash('sha256').update(canonicalText(fs.readFileSync(p,'utf8')),'utf8').digest('hex');
const binaryHash=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function resolveRepoFile(rel){if(!rel||path.isAbsolute(rel)||rel.includes('..'))throw new Error('repository-relative path required: '+rel);const full=path.join(root,rel);if(!fs.existsSync(full))throw new Error('referenced file does not exist: '+rel);return full;}
function loadPolicy(){return readJson(path.join(root,'data/architecture/animation-agentic-preparation.json'));}
function validateRequest(request,policy){const schema=readJson(path.join(root,policy.request_schema));const ajv=new Ajv({allErrors:true,strict:false});const validate=ajv.compile(schema);if(!validate(request))throw new Error('request schema validation failed: '+ajv.errorsText(validate.errors));if(!policy.allowed_agent_roles.some(x=>x.id===request.requestedByAgentRole))throw new Error('agent role is not allowed');}
function prepare({requestPath='animation/agentic-prep/starting-system-voltage-drop-request.json',write=false,outputPath}={}){
 const policy=loadPolicy();if(policy.default_policy!=='deny'||policy.output_committed!==false||policy.runtime_deployment_allowed!==false)throw new Error('ANIM-1E policy must fail closed');
 const request=readJson(resolveRepoFile(requestPath));validateRequest(request,policy);
 const manifestPath=resolveRepoFile(request.animationManifest),manifest=readJson(manifestPath);
 const manifestSchema=readJson(path.join(root,'schemas/animation-manifest.schema.json'));const ajv=new Ajv({allErrors:true,strict:false});const mv=ajv.compile(manifestSchema);const manifestErrors=validateManifest(manifest,path.basename(manifestPath),mv,root);if(manifestErrors.length)throw new Error('manifest validation failed: '+manifestErrors.join('; '));
 if(!policy.allowed_manifest_statuses.includes(manifest.governance.status))throw new Error('manifest status is not eligible for agentic preparation');
 const g=manifest.governance;for(const [name,value] of Object.entries({publicationAllowed:g.publicationAllowed,assessmentEligible:g.assessmentEligible,scoredAssessmentApproved:g.scoredAssessmentApproved,humanApprovalRecorded:g.humanApprovalRecorded,agentMayApprove:g.agentMayApprove,agentMayRelease:g.agentMayRelease,vehicleSpecificClaims:g.vehicleSpecificClaims}))if(value!==false)throw new Error(name+' boundary violated');
 const refs=[...manifest.evidence.engineeringArtifactRefs,...manifest.evidence.approvedEvidenceRefs];
 const records=[{role:'manifest',path:request.animationManifest,sha256:textHash(manifestPath),hashPolicy:'sha256-utf8-lf-normalized'}];
 for(const rel of refs)records.push({role:'evidence-or-engineering',path:rel,sha256:textHash(resolveRepoFile(rel)),hashPolicy:'sha256-utf8-lf-normalized'});
 if(manifest.rendering.assetPath)records.push({role:'review-asset',path:manifest.rendering.assetPath,sha256:binaryHash(resolveRepoFile(manifest.rendering.assetPath)),hashPolicy:'sha256-bytes'});
 if(manifest.rendering.fallbackImagePath)records.push({role:'static-fallback',path:manifest.rendering.fallbackImagePath,sha256:textHash(resolveRepoFile(manifest.rendering.fallbackImagePath)),hashPolicy:'sha256-utf8-lf-normalized'});
 const packet={schemaVersion:'1.0.0',packetType:'animation-agentic-review-preparation',requestId:request.requestId,animationId:manifest.animationId,status:policy.packet_contract.status,requestedByAgentRole:request.requestedByAgentRole,operation:request.operation,deterministic:true,sourceRecords:records.sort((a,b)=>a.path.localeCompare(b.path)),manifestSummary:{classification:manifest.classification,governance:{...manifest.governance},componentIds:manifest.components.map(x=>x.id),stepIds:manifest.steps.map(x=>x.id)},unresolvedHumanGates:[...policy.human_gates],hardBoundaries:{...policy.hard_boundaries},nextAction:'Human reviewers may inspect this packet; agents may not approve, publish, release, or change assessment eligibility.'};
 if(write){const rel=outputPath||path.posix.join(policy.output_directory,request.requestId+'.json');const out=path.join(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(packet,null,2)+'\n','utf8');return{packet,outputPath:rel};}
 return{packet,outputPath:null};
}
if(require.main===module){const args=process.argv.slice(2),write=args.includes('--write'),requestArg=args.find(x=>x.endsWith('.json'));const result=prepare({requestPath:requestArg||undefined,write});console.log(write?'[PASS] ANIM-1E review packet prepared: '+result.outputPath:JSON.stringify(result.packet,null,2));}
module.exports={prepare,textHash,binaryHash};
