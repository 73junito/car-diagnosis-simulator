"use strict";

(async function initMultiVoltageLab3d(){
  const stateSelect=document.getElementById("stateSelect");
  const faultSelect=document.getElementById("faultSelect");
  const domainSelect=document.getElementById("engineeringDomainSelect");
  const currentInput=document.getElementById("domainCurrentInput");
  const domainVoltage=document.getElementById("domainVoltage");
  const domainBoundary=document.getElementById("domainBoundary");
  const enteredCurrent=document.getElementById("enteredCurrent");
  const calculatedPower=document.getElementById("calculatedPower");
  const powerNote=document.getElementById("powerNote");
  const domainStatus=document.getElementById("domainStatus");
  const domainComparison=document.getElementById("domainComparison");
  const assetGallery=document.getElementById("assetGallery");
  const toolList=document.getElementById("toolList");
  const activeTool=document.getElementById("activeTool");
  const activeTestPoint=document.getElementById("activeTestPoint");
  const toolReading=document.getElementById("toolReading");
  const toolReadingNote=document.getElementById("toolReadingNote");
  const testpointList=document.getElementById("testpointList");
  const governanceBanner=document.getElementById("governanceBanner");

  const calculator=window.TorqueMindEngineeringCalculator;
  const stateResolver=window.TorqueMindMultiVoltageEngineeringState;
  const Viewer=window.AutoLearnProGlbViewer?.GlbViewer;
  const Scene=window.AutoLearnProPresentation?.MultiVoltageLabScene;
  if(!calculator||!stateResolver||!Viewer||!Scene)return;

  let circuit=null;
  let scene=null;
  let operatingState="traction-drive-example";
  let activeFault="";
  const viewers=[];
  const prefersReducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;

  const toolNames={
    "tool.dmm":"Digital Multimeter",
    "tool.current-clamp":"Current Clamp",
    "tool.scan-tool":"Diagnostic Scan Tool",
    "tool.temperature-probe":"Temperature Probe"
  };

  function currentState(){
    return circuit.operatingStates.find((state)=>state.id===operatingState)||circuit.operatingStates[0];
  }

  function currentFault(){
    return activeFault ? circuit.faultCatalog.find((fault)=>fault.id===activeFault)||null : null;
  }

  function selectedDomain(){
    return circuit.voltageSystems.find((domain)=>domain.id===domainSelect.value)||circuit.voltageSystems[0];
  }

  function enteredCurrentValue(){
    const raw=currentInput.value.trim();
    if(!raw)return null;
    const value=Number(raw);
    return Number.isFinite(value)&&value>0?value:null;
  }

  function domainIsActive(domainId){
    const flows=currentState().activeFlows||{};
    if(domainId==="LV12")return Boolean((flows.lvPower||[]).length||(flows.lvGround||[]).length||(flows.control||[]).length);
    if(domainId==="TR400")return Boolean((flows.traction||[]).length||(flows.tractionReturn||[]).length);
    return false;
  }

  function selectedDomainFault(){
    const fault=currentFault();
    if(!fault)return null;
    const connection=circuit.connections.find((item)=>item.id===fault.targetConnectionId);
    return connection?.voltageSystemId===domainSelect.value?fault:null;
  }

  function getEngineeringState(){
    const domain=selectedDomain();
    const fault=selectedDomainFault();
    return stateResolver.calculateMultiVoltageEngineeringState({
      calculator,
      domain,
      enteredCurrentValue:enteredCurrentValue(),
      domainActive:domainIsActive(domain.id),
      faultType:fault?.type||null
    });
  }

  function renderEngineering(){
    const state=getEngineeringState();
    domainVoltage.textContent=state.domain.nominalVoltage+" V";
    domainBoundary.textContent=state.boundary;
    enteredCurrent.textContent=state.hasCurrent?Number(state.enteredCurrentValue.toFixed(2))+" A":"—";
    calculatedPower.textContent=state.power
      ?(state.power.value>=1000?(state.power.value/1000).toFixed(3)+" kW":Number(state.power.value.toFixed(2))+" W")
      :"—";
    powerNote.textContent=state.hasCurrent
      ?"Calculated from the declared domain voltage and explicit entered current only."
      :"P = V × I only when a positive current is entered.";
    domainStatus.textContent=state.status;
    domainComparison.textContent=state.comparison;
    return state;
  }

  function assetDomainActive(asset){
    const ids=asset.voltageSystemIds||[asset.voltageSystemId].filter(Boolean);
    if(!ids.length)return true;
    return ids.some((id)=>domainIsActive(id));
  }

  function renderAssetActivity(){
    for(const asset of scene.getAssets()){
      const card=assetGallery.querySelector('[data-asset-id="'+asset.id+'"]');
      if(card)card.dataset.active=String(assetDomainActive(asset));
    }
  }

  function testPointText(tp){
    if(tp.trainingSafetyBoundary==="conceptual-only"){
      return "Conceptual-only traction test location — no numeric value inferred.";
    }
    if(tp.id==="TP_CONTROL_CMD"){
      return "Control signal value not inferred; vehicle-specific data required.";
    }
    return "Vehicle-specific test-point value required.";
  }

  function renderTestPoints(){
    testpointList.replaceChildren();
    activeTestPoint.replaceChildren();
    for(const tp of scene.getTestPoints()){
      const row=document.createElement("div");
      row.className="testpoint-item";
      row.dataset.testPointId=tp.id;
      if(tp.trainingSafetyBoundary)row.dataset.safety=tp.trainingSafetyBoundary;
      const name=document.createElement("strong");
      name.textContent=tp.id;
      const detail=document.createElement("span");
      detail.textContent=testPointText(tp);
      row.append(name,detail);
      testpointList.append(row);

      const option=document.createElement("option");
      option.value=tp.id;
      option.textContent=tp.label;
      activeTestPoint.append(option);
    }
  }

  function renderTools(){
    toolList.replaceChildren();
    activeTool.replaceChildren();
    for(const toolId of scene.runtime.toolIds||[]){
      const row=document.createElement("div");
      row.className="tool-item";
      row.dataset.toolId=toolId;
      const name=document.createElement("strong");
      name.textContent=toolNames[toolId]||toolId;
      const state=document.createElement("span");
      state.textContent=scene.isToolEnabled(toolId)?"Runtime enabled · 3D asset available":"Runtime enabled · 3D asset unavailable";
      row.append(name,state);
      toolList.append(row);

      const option=document.createElement("option");
      option.value=toolId;
      option.textContent=toolNames[toolId]||toolId;
      activeTool.append(option);
    }
    activeTool.value="tool.dmm";
  }

  function renderToolReading(){
    const toolId=activeTool.value;
    const tp=scene.getTestPoint(activeTestPoint.value);
    if(!tp){
      toolReading.textContent="Select a declared test point";
      toolReadingNote.textContent="No measurement is generated by the 3D presentation.";
      return;
    }

    if(toolId==="tool.current-clamp"){
      toolReading.textContent="Current not inferred";
      toolReadingNote.textContent="Entered current is calculation input only and is not treated as a clamp measurement.";
      return;
    }
    if(toolId==="tool.temperature-probe"){
      toolReading.textContent="Temperature not inferred";
      toolReadingNote.textContent="No thermal model exists for the battery, converter, inverter, or motor.";
      return;
    }
    if(toolId==="tool.scan-tool"){
      toolReading.textContent="Diagnostic PID not inferred";
      toolReadingNote.textContent="No RPM, speed, position, command-state, isolation, interlock, or vehicle-specific diagnostic PID is generated.";
      return;
    }

    if(tp.trainingSafetyBoundary==="conceptual-only"){
      toolReading.textContent="Conceptual-only traction test location";
      toolReadingNote.textContent="The DMM does not display or imply a traction-domain measurement or service procedure.";
      return;
    }
    toolReading.textContent="Vehicle-specific value required";
    toolReadingNote.textContent=tp.id==="TP_CONTROL_CMD"
      ?"The generic model does not infer a control-command voltage, duty cycle, frequency, or waveform."
      :"The generic model does not infer a numeric test-point voltage.";
  }

  async function renderAssets(){
    assetGallery.replaceChildren();
    for(const asset of scene.getAssets()){
      const card=document.createElement("article");
      card.className="asset-card";
      card.dataset.assetId=asset.id;
      card.dataset.domain=asset.voltageSystemId||(asset.voltageSystemIds?"MULTI":"");
      card.dataset.active=String(assetDomainActive(asset));

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
      if(asset.id.startsWith("component.")){
        role.textContent="Generic project-authored component geometry only. Internal electrical, thermal, switching, conversion, torque, and current behavior is not simulated by this asset.";
      }else if(asset.kind==="diagnostic-tool"){
        role.textContent="Diagnostic-tool geometry is runtime-gated and presentation-only; it does not create measurements.";
      }else{
        role.textContent="Visual context only; no engineering or measurement authority.";
      }
      card.append(head,canvas,status,role);
      assetGallery.append(card);

      if(!asset.enabled)continue;
      const viewer=new Viewer(canvas,status);
      viewers.push({viewer,speed:Number(asset.animation?.speed)||0});
      try{
        await viewer.load(asset.url,asset.title);
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

  function refresh(){
    renderEngineering();
    renderAssetActivity();
    renderToolReading();
  }

  stateSelect.addEventListener("change",()=>{operatingState=stateSelect.value;refresh();});
  faultSelect.addEventListener("change",()=>{
    activeFault=faultSelect.value;
    scene.setActiveFault(activeFault||null);
    refresh();
  });
  domainSelect.addEventListener("change",refresh);
  currentInput.addEventListener("input",refresh);
  currentInput.addEventListener("change",refresh);
  activeTool.addEventListener("change",renderToolReading);
  activeTestPoint.addEventListener("change",renderToolReading);

  try{
    const [runtimeResponse,manifestResponse,circuitResponse]=await Promise.all([
      fetch("/data/architecture/multivoltage-lab-lmf-runtime.json"),
      fetch("/data/architecture/multivoltage-lab-3d-assets.json"),
      fetch("/data/circuit-templates/electrified-multivoltage.json")
    ]);
    if(!runtimeResponse.ok||!manifestResponse.ok||!circuitResponse.ok){
      throw new Error("Required Multivoltage Lab contracts could not be loaded.");
    }
    const runtime=await runtimeResponse.json();
    const manifest=await manifestResponse.json();
    circuit=await circuitResponse.json();

    scene=new Scene();
    const summary=scene.loadContracts({runtime,manifest,template:circuit});

    stateSelect.replaceChildren();
    for(const state of circuit.operatingStates){
      const option=document.createElement("option");
      option.value=state.id;
      option.textContent=state.label;
      option.selected=state.id==="traction-drive-example";
      stateSelect.append(option);
    }

    faultSelect.replaceChildren();
    const none=document.createElement("option");
    none.value="";
    none.textContent="No injected fault";
    faultSelect.append(none);
    for(const fault of circuit.faultCatalog){
      const option=document.createElement("option");
      option.value=fault.id;
      option.textContent=fault.label;
      faultSelect.append(option);
    }

    renderTools();
    renderTestPoints();
    governanceBanner.textContent=
      "Presentation-only classroom. All five authority flags are false; "+summary.assetCount+
      " GLB assets are registered, "+summary.enabledToolAssetCount+
      " runtime tool models are enabled, and traction-domain test points remain conceptual-only.";

    await renderAssets();
    refresh();
    document.documentElement.dataset.multivoltageLab3dClassroom="presentation-only";
  }catch(error){
    console.error(error);
    governanceBanner.textContent="The 3D classroom could not be loaded. The governed 2D Multivoltage Lab remains available. "+error.message;
  }
})();