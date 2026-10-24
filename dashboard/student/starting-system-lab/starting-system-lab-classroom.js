"use strict";

(async function initStartingSystemLab3d(){
  const assetGallery=document.getElementById("assetGallery");
  const toolList=document.getElementById("toolList");
  const testPointList=document.getElementById("testPointList");
  const stateList=document.getElementById("stateList");
  const faultList=document.getElementById("faultList");
  const governanceBanner=document.getElementById("governanceBanner");

  const Viewer=window.AutoLearnProGlbViewer?.GlbViewer;
  const Scene=window.AutoLearnProPresentation?.StartingSystemLabScene;
  if(!Viewer||!Scene)return;

  const viewers=[];
  const prefersReducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;

  const toolNames={
    "tool.dmm":"Digital Multimeter",
    "tool.current-clamp":"Current Clamp"
  };

  function renderTools(scene){
    toolList.replaceChildren();
    for(const toolId of scene.runtime.toolIds||[]){
      const row=document.createElement("div");
      row.className="tool-item";
      row.dataset.toolId=toolId;
      const name=document.createElement("strong");
      name.textContent=toolNames[toolId]||toolId;
      const state=document.createElement("span");
      state.textContent=scene.isToolEnabled(toolId)
        ?"Runtime enabled · 3D asset available"
        :"Runtime enabled · 3D asset unavailable";
      row.append(name,state);
      toolList.append(row);
    }
  }

  function renderTestPoints(scene){
    testPointList.replaceChildren();
    for(const tp of scene.getTestPoints()){
      const row=document.createElement("div");
      row.className="testpoint-item";
      row.dataset.testPointId=tp.id;
      const name=document.createElement("strong");
      name.textContent=tp.label;
      const detail=document.createElement("span");
      detail.textContent=tp.id+" → "+tp.terminalId+" · "+tp.measurementTypes.join(" / ")+" · vehicle-specific value required";
      row.append(name,detail);
      testPointList.append(row);
    }
  }

  function renderStates(template){
    stateList.replaceChildren();
    for(const state of template.operatingStates||[]){
      const row=document.createElement("div");
      row.className="contract-item";
      const name=document.createElement("strong");
      name.textContent=state.label;
      const detail=document.createElement("span");
      detail.textContent=state.id+" · conceptual circuit-flow state from authoritative template";
      row.append(name,detail);
      stateList.append(row);
    }
  }

  function renderFaults(template){
    faultList.replaceChildren();
    for(const fault of template.faultCatalog||[]){
      const row=document.createElement("div");
      row.className="contract-item";
      const name=document.createElement("strong");
      name.textContent=fault.label;
      const detail=document.createElement("span");
      detail.textContent=fault.type+" · "+fault.id;
      row.append(name,detail);
      faultList.append(row);
    }
  }

  async function renderAssets(scene){
    assetGallery.replaceChildren();
    for(const asset of scene.getAssets()){
      const card=document.createElement("article");
      card.className="asset-card";
      card.dataset.assetId=asset.id;
      card.dataset.enabled=String(asset.enabled);

      const head=document.createElement("div");
      head.className="asset-card__head";
      const title=document.createElement("strong");
      title.textContent=asset.title;
      const kind=document.createElement("span");
      kind.className="asset-kind";
      kind.textContent=asset.kind;
      head.append(title,kind);

      const canvas=document.createElement("canvas");
      canvas.className="asset-canvas";
      canvas.tabIndex=0;

      const status=document.createElement("div");
      status.className="asset-status";
      status.textContent=asset.enabled?"Preparing 3D model…":"Asset disabled by runtime.";

      const role=document.createElement("div");
      role.className="asset-role";
      if(asset.kind==="component"){
        role.textContent="Generic project-authored Starting System component geometry only. It does not simulate starter current, speed, torque, solenoid force, cranking RPM, or vehicle-specific electrical behavior.";
      }else if(asset.kind==="diagnostic-tool"){
        role.textContent="Diagnostic-tool geometry is enabled only because the runtime declares the tool. The 3D model does not create measurements.";
      }else{
        role.textContent="Visual context only; no engineering, measurement, assessment, or publication authority.";
      }

      card.append(head,canvas,status,role);
      assetGallery.append(card);

      if(!asset.enabled)continue;
      const viewer=new Viewer(canvas,status);
      viewers.push({viewer,speed:Number(asset.animation?.speed)||0});
      try{
        const review=new URLSearchParams(window.location.search).get("visualReview")==="1";
       const reviewFile=asset.title==="Generic Starter Motor"?"starter-motor-detailed-review.glb":
         asset.title==="Generic Starter Solenoid"?"starter-solenoid-detailed-review.glb":null;
       const reviewUrl=review&&reviewFile?"/dashboard/student/starting-system-lab/assets/3d/"+reviewFile:asset.url;
       viewer.detailedLighting=review&&!!reviewFile;
       await viewer.load(reviewUrl,asset.title);
      }catch(error){
        status.textContent="Unable to render "+asset.title+": "+error.message;
        status.dataset.state="unavailable";
      }
    }

    if(!prefersReducedMotion){
      const animate=()=>{
        for(const item of viewers){
          if(!item.viewer?.gl||!item.viewer.drawables?.length)continue;
          item.viewer.yaw+=item.speed;
          item.viewer.render();
        }
        window.requestAnimationFrame(animate);
      };
      window.requestAnimationFrame(animate);
    }
  }

  try{
    const [runtimeResponse,manifestResponse,templateResponse]=await Promise.all([
      fetch("/data/architecture/starting-system-lmf-runtime.json"),
      fetch("/data/architecture/starting-system-lab-3d-assets.json"),
      fetch("/data/circuit-templates/12v-starting-system.json")
    ]);
    if(!runtimeResponse.ok||!manifestResponse.ok||!templateResponse.ok){
      throw new Error("Required Starting System contracts could not be loaded.");
    }

    const runtime=await runtimeResponse.json();
    const manifest=await manifestResponse.json();
    const template=await templateResponse.json();
    const scene=new Scene();
    const summary=scene.loadContracts({runtime,manifest,template});

    renderTools(scene);
    renderTestPoints(scene);
    renderStates(template);
    renderFaults(template);
    governanceBanner.textContent=
      "Presentation-only classroom. All five authority flags are false; "+summary.assetCount+
      " GLB assets are registered, "+summary.enabledToolAssetCount+
      " diagnostic-tool models are runtime-enabled, and "+summary.testPointCount+
      " authoritative test points are bound without numeric inference.";

    await renderAssets(scene);
    document.documentElement.dataset.startingSystemLab3dClassroom="presentation-only";
  }catch(error){
    console.error(error);
    governanceBanner.textContent=
      "The 3D classroom could not be loaded. The governed 2D Starting System Lab remains available. "+error.message;
  }
})();