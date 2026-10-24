"use strict";
// Structural preflight for the existing TypeScript MNA translator. Not a numerical solver.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
function inspectElectricalCompatibility(modelRef){
 if(typeof modelRef!=="string"||!modelRef.startsWith("/data/")||!modelRef.endsWith(".json")||modelRef.includes(".."))throw Error("Unsafe model reference");
 const model=JSON.parse(fs.readFileSync(path.join(root,modelRef.slice(1)),"utf8"));
 const components=model.components||[];
 const parameters=model.elementParameters||[];
 const reasons=[];
 const referenceNodes=components.filter(c=>c.type==="ground");
 if(referenceNodes.length!==1)reasons.push({code:"REFERENCE_GROUND_REQUIRED",detail:"MNA translator requires exactly one ground component"});
 for(const battery of components.filter(c=>c.type==="battery")){
  for(const id of ["sourceVoltage","internalResistance"]){
   if(!parameters.some(p=>p.elementId===battery.id&&p.parameterId===id&&Number.isFinite(p.value)))
    reasons.push({code:"BATTERY_PARAMETER_REQUIRED",componentId:battery.id,parameterId:id});
  }
 }
 if(!components.length)reasons.push({code:"COMPONENTS_REQUIRED"});
 return Object.freeze({modelRef,solverId:"typescript-mna",compatible:reasons.length===0,
  status:reasons.length?"model-requires-parameters":"structural-preflight-only",
  reasons:Object.freeze(reasons.map(x=>Object.freeze(x))),
  notice:"Passing structural preflight is not numerical validation or authority to compute measurements."});
}
module.exports={inspectElectricalCompatibility};
