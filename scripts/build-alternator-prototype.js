"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process");
const {findCadQueryPython}=require("./resolve-cadquery-environment");
const {findBlender}=require("./run-blender-animation-pipeline");
const root=path.resolve(__dirname,"..");
const folder=path.join(root,"animation","cadquery","output","alternator-prototype");
function run(exe,args){const r=cp.spawnSync(exe,args,{cwd:root,stdio:"inherit",windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error(exe+" failed: "+r.status)}
function verify(){
 const metadata=JSON.parse(fs.readFileSync(path.join(folder,"metadata.json"),"utf8"));
 for(const k of ["presentationOnly","vehicleSpecific","engineeringAuthority","measurementAuthority","assessmentAuthority","publicationAuthority"]){
  if(metadata[k]!== (k==="presentationOnly"))throw Error("governance mismatch: "+k);
 }
 if(metadata.referenceIsEngineeringSource!==false)throw Error("Meshy reference must not be authoritative");
 const wanted=Object.keys(metadata.parts);
 if(wanted.length!==7||!metadata.parts.pulley.movable||!metadata.parts["rotor-shaft"].movable)throw Error("part contract mismatch");
 const b=fs.readFileSync(path.join(folder,"alternator-governed-prototype.glb"));
 if(b.toString("ascii",0,4)!=="glTF"||b.readUInt32LE(8)!==b.length||b.readUInt32LE(4)!==2)throw Error("invalid GLB header");
 const length=b.readUInt32LE(12),j=JSON.parse(b.toString("utf8",20,20+length));
 if((j.meshes||[]).length!==7||(j.animations||[]).length!==0)throw Error("unexpected mesh or baked animation");
 const nodes=j.nodes||[];
 if(nodes.length!==7)throw Error("unexpected scene node count");
 for(const part of wanted){
  const node=nodes.find(x=>x.name==="ALT1_"+part.replace(/-/g,"_"));
  if(!node||typeof node.mesh!=="number")throw Error("missing node: "+part);
  const e=node.extras||{};
  for(const field of ["engineeringAuthority","measurementAuthority","vehicleSpecific","publicationAuthority"]){
   if(e[field]!==false)throw Error(part+" has unsafe authority: "+field);
  }
  if(e.presentationOnly!==true||e.animationEligible!==metadata.parts[part].movable)throw Error(part+" presentation/motion mismatch");
  if(metadata.parts[part].movable){
   if(e.runtimeDrivenOnly!==true||e.rotationAxis!=="X")throw Error(part+" missing governed animation axis");
   const t=node.translation||[0,0,0];if(Math.abs(t[1])>0.000001||Math.abs(t[2])>0.000001)throw Error(part+" rotation pivot not on shaft centerline");
  }else if(e.runtimeDrivenOnly===true)throw Error(part+" unexpectedly animated");
 }
 console.log("[PASS] alternator: seven named nodes; centered rotating pivots; no baked animation or authority");
}
function main(){
 const cad=findCadQueryPython(),blender=findBlender();
 if(!cad||!blender)throw Error("CadQuery and Blender required");
 run(cad,[path.join(root,"animation/cadquery/scripts/build_alternator_prototype.py")]);
 run(blender,["--background","--factory-startup","--python",path.join(root,"animation/blender/scripts/convert_alternator_prototype.py")]);
 verify();
}
if(require.main===module){try{main()}catch(e){console.error("[FAIL]",e.message);process.exitCode=1}}
module.exports={main,verify};
