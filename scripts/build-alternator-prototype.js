"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process");
const {findCadQueryPython}=require("./resolve-cadquery-environment");
const {findBlender}=require("./run-blender-animation-pipeline");
const root=path.resolve(__dirname,"..");
const folder=path.join(root,"animation","cadquery","output","alternator-prototype");
const cad=path.join(root,"animation","cadquery","scripts","build_alternator_prototype.py");
const converter=path.join(root,"animation","blender","scripts","convert_alternator_prototype.py");
function run(exe,args){const r=cp.spawnSync(exe,args,{cwd:root,stdio:"inherit",windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error(exe+" failed: "+r.status)}
function verify(){
 const f=path.join(folder,"alternator-governed-prototype.glb");
 const metadata=JSON.parse(fs.readFileSync(path.join(folder,"metadata.json"),"utf8"));
 for(const k of ["presentationOnly","vehicleSpecific","engineeringAuthority","measurementAuthority","assessmentAuthority","publicationAuthority"]) {
   if(metadata[k]!== (k==="presentationOnly"))throw Error("governance mismatch: "+k);
 }
 const wanted=Object.keys(metadata.parts);
 if(wanted.length!==7 || !metadata.parts["pulley"].movable || !metadata.parts["rotor-shaft"].movable)throw Error("part contract mismatch");
 const b=fs.readFileSync(f);
 if(b.toString("ascii",0,4)!=="glTF" || b.readUInt32LE(8)!==b.length)throw Error("invalid GLB container");
 const length=b.readUInt32LE(12),j=JSON.parse(b.toString("utf8",20,20+length));
 const names=(j.nodes||[]).map(x=>x.name);
 for(const p of wanted)if(!names.includes("ALT1_"+p.replace(/-/g,"_")))throw Error("missing node: "+p);
 if((j.meshes||[]).length!==7 || (j.animations||[]).length!==0)throw Error("unexpected mesh or baked animation");
 console.log("[PASS] review-only alternator: seven named GLB meshes; no animations or engineering authority");
}
function main(){
 const cadpython=findCadQueryPython(),blender=findBlender();
 if(!cadpython||!blender)throw Error("CadQuery and Blender required");
 run(cadpython,[cad]);
 run(blender,["--background","--factory-startup","--python",converter]);
 verify();
}
if(require.main===module){try{main()}catch(err){console.error("[FAIL]",err.message);process.exitCode=1}}
module.exports={main,verify};
