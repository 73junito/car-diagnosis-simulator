"use strict";
// Headless LMF foundation: state identity/provenance only; no invented measurements or assessment authority.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const load=ref=>JSON.parse(fs.readFileSync(path.join(ROOT,ref),"utf8"));
const immutable=value=>{if(value&&typeof value==="object"){Object.values(value).forEach(immutable);Object.freeze(value)}return value};
function createRuntime(labId){
 const lab=load("data/lmf/lab-registry.json").labs.find(x=>x.labId===labId&&x.lifecycle==="existing"&&x.directPracticeAllowed);
 if(!lab)throw Error("Lab not registered for practice");
 const binding=load("data/architecture/"+labId+"-lmf-runtime.json");
 if(binding.labId!==labId||binding.engineeringAdapterId!==lab.engineeringAdapterId)throw Error("Runtime binding drift");
 if(binding.assessmentEligibilityAuthority!=="external-governance-only"||binding.publicationAuthority!=="external-human-governance-only")throw Error("Governance authority drift");
 const adapter=load("data/lmf/engineering-model-adapters.json").adapters.find(x=>x.adapterId===binding.engineeringAdapterId);
 if(!adapter||adapter.status==="planned")throw Error("Adapter unavailable");
 const ref=binding.modelRef;
 if(typeof ref!=="string"||!ref.startsWith("/data/")||!ref.endsWith(".json")||ref.includes(".."))throw Error("Unsafe model reference");
 const raw=fs.readFileSync(path.join(ROOT,ref.slice(1)));
 const model=JSON.parse(raw),hash=crypto.createHash("sha256").update(raw).digest("hex");
 const states=new Map((model.operatingStates||[]).map(x=>[x.id,x]));
 const faults=new Map((model.faultCatalog||[]).map(x=>[x.id,x]));
 const points=new Map((model.testPoints||[]).map(x=>[x.id,x]));
 const terminals=new Set((model.components||[]).flatMap(c=>(c.terminals||[]).map(t=>t.id)));
 const connections=new Set((model.connections||[]).map(x=>x.id));
 if(!states.size||!terminals.size)throw Error("Incomplete engineering model");
 for(const p of points.values())if(!terminals.has(p.terminalId))throw Error("Unknown test point terminal");
 for(const f of faults.values())if(f.targetConnectionId&&!connections.has(f.targetConnectionId))throw Error("Unknown fault target");
 const modelIdentity=immutable({modelRef:ref,modelId:model.circuitId||model.modelId||labId,sha256:hash});
 const resolveState=({operatingStateId,faultId=null}={})=>{
  if(!states.has(operatingStateId))throw Error("Unknown operating state");
  if(faultId!==null&&!faults.has(faultId))throw Error("Unknown fault");
  return immutable({schemaVersion:"1.0.0",labId,modelIdentity,adapterId:binding.engineeringAdapterId,operatingStateId,faultId,
   resolvedState:{operatingState:structuredClone(states.get(operatingStateId)),fault:faultId?structuredClone(faults.get(faultId)):null},
   provenance:{sourceRole:"engineering-model-derived",modelSha256:hash,runtime:"lmf-foundation-v0"}});
 };
 const measure=({operatingStateId,faultId=null,toolId,testPointId,measurementType}={})=>{
  const state=resolveState({operatingStateId,faultId});
  if(!binding.toolIds.includes(toolId))throw Error("Tool not authorized");
  const point=points.get(testPointId);
  if(!point)throw Error("Unknown test point");
  if(!(point.measurementTypes||[]).includes(measurementType))throw Error("Measurement unsupported at test point");
  if(!(binding.modeledMeasurementTypes||[]).includes(measurementType))throw Error("Measurement not model-derived");
  return immutable({status:"solver-not-connected",measurement:null,request:{toolId,testPointId,measurementType},
   modelIdentity,operatingStateId,faultId,provenance:state.provenance});
 };
 return Object.freeze({labId,modelIdentity,adapterId:binding.engineeringAdapterId,resolveState,measure});
}
module.exports={createRuntime,...require('./solver-registry'),...require('./electrical-compatibility')};
