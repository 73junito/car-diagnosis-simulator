"use strict";

const fs=require("fs");
const path=require("path");
const {parseGlb}=require("./verify-circuit-lab-3d-assets");

const ROOT=path.resolve(__dirname,"..");
const readJson=(relative)=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),"utf8"));
const runtime=readJson("data/architecture/starting-system-lmf-runtime.json");
const manifest=readJson("data/architecture/starting-system-lab-3d-assets.json");
const template=readJson("data/circuit-templates/12v-starting-system.json");

function localPathFromUrl(url){
  return path.join(ROOT,String(url).replace(/^\//,""));
}

function validateStartingSystemLab3dAssets(){
  if(manifest.presentationRole!=="starting-system-lab-3d-presentation-only"){
    throw new Error("Starting System 3D presentation role drift");
  }
  if(manifest.authoritativeRuntime!=="/data/architecture/starting-system-lmf-runtime.json"){
    throw new Error("Starting System 3D manifest runtime binding drift");
  }
  if(manifest.authoritativeTemplate!==runtime.modelRef){
    throw new Error("Starting System 3D manifest model binding drift");
  }
  for(const [key,value] of Object.entries(manifest.authority||{})){
    if(value!==false)throw new Error("Starting System 3D authority must remain false: "+key);
  }

  const assets=manifest.assets||[];
  const runtimeTools=[...(runtime.toolIds||[])].sort();
  const enabledToolIds=assets
    .filter((asset)=>asset.kind==="diagnostic-tool"&&runtimeTools.includes(asset.toolId))
    .map((asset)=>asset.toolId)
    .sort();
  if(JSON.stringify(enabledToolIds)!==JSON.stringify(runtimeTools)){
    throw new Error("Starting System runtime tools do not have exact 3D asset coverage");
  }

  const pointIds=template.testPoints.map((point)=>point.id);
  const bindingIds=(manifest.testPointBindings||[]).map((binding)=>binding.testPointId);
  if(JSON.stringify(bindingIds)!==JSON.stringify(pointIds)){
    throw new Error("Starting System 3D test-point bindings must exactly match the authoritative template");
  }
  const components=new Set(template.components.map((component)=>component.id));
  for(const binding of manifest.testPointBindings||[]){
    if(binding.componentId&&!components.has(binding.componentId)){
      throw new Error("Unknown Starting System component binding: "+binding.componentId);
    }
  }

  const parsed=[];
  for(const asset of assets){
    if(String(asset.url).includes("animation/review-assets/")){
      throw new Error("Starting System classroom may not reference review-only animation assets");
    }
    const file=localPathFromUrl(asset.url);
    if(!fs.existsSync(file))throw new Error("Missing Starting System 3D asset: "+asset.url);
    const info=parseGlb(file);
    parsed.push({assetId:asset.assetId,bytes:info.buffer.length,primitives:info.primitives.length});
  }

  const authored=assets.filter((asset)=>asset.sourceRole==="project-authored-cadquery-generic-training-geometry");
  if(authored.length!==4)throw new Error("Expected four CadQuery-authored Starting System component assets");
  if(authored.some((asset)=>asset.vehicleSpecific!==false)){
    throw new Error("Starting System CadQuery assets must remain explicitly non-vehicle-specific");
  }

  for(const required of [
    "animation/cadquery/scripts/build_starting_system_components.py",
    "scripts/build-starting-system-3d-assets.js",
    "src/presentation/starting-system-lab-scene.js",
    "dashboard/student/starting-system-lab/starting-system-lab-3d.html",
    "dashboard/student/starting-system-lab/starting-system-lab-classroom.js"
  ]){
    if(!fs.existsSync(path.join(ROOT,required)))throw new Error("Missing Starting System 3D source: "+required);
  }

  const classroom=fs.readFileSync(path.join(ROOT,"dashboard/student/starting-system-lab/starting-system-lab-classroom.js"),"utf8");
  const html=fs.readFileSync(path.join(ROOT,"dashboard/student/starting-system-lab/starting-system-lab-3d.html"),"utf8");
  if((classroom+"\n"+html).includes("starting-system-voltage-drop-review.glb")){
    throw new Error("Starting System classroom must not publish the blocked review GLB");
  }

  return{
    assetCount:assets.length,
    parsed,
    enabledToolIds,
    testPointCount:bindingIds.length,
    authoredComponentCount:authored.length
  };
}

if(require.main===module){
  const result=validateStartingSystemLab3dAssets();
  console.log(
    "[PASS] Starting System 3D assets: "+result.assetCount+" GLBs, "+
    result.testPointCount+" test points, "+result.authoredComponentCount+" reproducible components"
  );
}

module.exports={validateStartingSystemLab3dAssets};
