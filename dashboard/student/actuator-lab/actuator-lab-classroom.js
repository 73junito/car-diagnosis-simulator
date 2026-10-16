"use strict";

(async function initActuatorLab3dClassroom(){
  const stateSelect=document.getElementById("stateSelect");
  const faultSelect=document.getElementById("faultSelect");
  const dutyInput=document.getElementById("dutyInput");
  const dutyInputValue=document.getElementById("dutyInputValue");
  const supplyValue=document.getElementById("supplyValue");
  const ecmCommandValue=document.getElementById("ecmCommandValue");
  const ecmCommandNote=document.getElementById("ecmCommandNote");
  const actuatorCommandValue=document.getElementById("actuatorCommandValue");
  const actuatorCommandNote=document.getElementById("actuatorCommandNote");
  const pathAvailability=document.getElementById("pathAvailability");
  const assetGallery=document.getElementById("assetGallery");
  const toolList=document.getElementById("toolList");
  const activeTool=document.getElementById("activeTool");
  const toolReading=document.getElementById("toolReading");
  const toolReadingNote=document.getElementById("toolReadingNote");
  const testpointList=document.getElementById("testpointList");
  const probeRedTarget=document.getElementById("probeRedTarget");
  const probeBlackTarget=document.getElementById("probeBlackTarget");
  const dockRed=document.getElementById("dockRed");
  const dockBlack=document.getElementById("dockBlack");
  const probeStatus=document.getElementById("probeStatus");
  const governanceBanner=document.getElementById("governanceBanner");

  const calculator=window.TorqueMindEngineeringCalculator;
  const actuatorState=window.TorqueMindActuatorEngineeringState;
  const artifacts=window.TorqueMindEngineeringArtifacts;
  const Viewer=window.AutoLearnProGlbViewer?.GlbViewer;
  const ActuatorLabScene=window.AutoLearnProPresentation?.ActuatorLabScene;
  if(!calculator||!actuatorState||!Viewer||!ActuatorLabScene)return;

  let scene=null;
  let circuit=null;
  let profile=null;
  let supplyVoltage=12;
  let dutyCycle=30;
  let operatingState="pwm-low-example";
  let activeFault="";
  let nominalShortGroundArtifact=null;
  let stateDuty=new Map();
  const viewers=[];
  const prefersReducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;

  const faultTargets={
    FAULT_OPEN_ACT_POWER:["TP_ACT_POWER"],
    FAULT_HIGH_RES_ACT_POWER:["TP_ACT_POWER"],
    FAULT_OPEN_ACT_GROUND:["TP_ACT_GROUND"],
    FAULT_HIGH_RES_ACT_GROUND:["TP_ACT_GROUND"],
    FAULT_OPEN_PWM:["TP_PWM"],
    FAULT_PWM_SHORT_GROUND:["TP_PWM"],
    FAULT_PWM_SHORT_POWER:["TP_PWM"]
  };

  const toolNames={
    "tool.dmm":"Digital Multimeter",
    "tool.oscilloscope":"Oscilloscope",
    "tool.scan-tool":"Scan Tool",
    "tool.current-clamp":"Current Clamp"
  };

  function formatVoltage(value){
    if(value===null||value===undefined)return "—";
    return Number(value.toFixed(3))+" V";
  }

  function faultBehavior(){
    return (profile?.faultBehavior||[]).find((item)=>item.faultId===activeFault)||null;
  }

  function currentState(){
    let artifact=null;
    if(activeFault==="FAULT_PWM_SHORT_GROUND"&&dutyCycle===30&&nominalShortGroundArtifact?.status==="ready"){
      const baseline=artifacts.quantityFromArtifact(nominalShortGroundArtifact.artifact,"baseline");
      const observed=artifacts.quantityFromArtifact(nominalShortGroundArtifact.artifact,"observed");
      artifact={baseline:baseline.value,observed:observed.value};
    }
    return actuatorState.calculateActuatorEngineeringState({
      calculator,
      supplyVoltage,
      dutyCyclePercent:dutyCycle,
      operatingState,
      faultBehavior:faultBehavior(),
      shortGroundArtifact:artifact
    });
  }

  function renderEngineering(){
    const result=currentState();
    supplyValue.textContent=supplyVoltage+" V";
    ecmCommandValue.textContent=result.commandActive?formatVoltage(result.ideal.value)+" avg":"—";
    ecmCommandNote.textContent=result.commandActive
      ? dutyCycle+"% generic command; mathematical PWM average only."
      : "No active ECM PWM command in this operating state.";
    actuatorCommandValue.textContent=result.observed===null?"—":formatVoltage(result.observed)+" avg";
    actuatorCommandNote.textContent=result.note+" This is modeled training state, not a measurement.";
    pathAvailability.textContent=result.power+" / "+result.ground;
    return result;
  }

  function testPointDisplay(id,result){
    if(id==="TP_ACT_POWER"){
      return {text:"Power path: "+result.power,numeric:null,note:"Vehicle-specific test-point value required."};
    }
    if(id==="TP_ACT_GROUND"){
      return {text:"Ground path: "+result.ground,numeric:null,note:"Vehicle-specific test-point value required."};
    }
    if(id==="TP_ECM_PWM"){
      if(!result.commandActive)return {text:"No active PWM command",numeric:null,note:"ECM-side command inactive."};
      return {
        text:dutyCycle+"% command · "+formatVoltage(result.ideal.value)+" avg training math",
        numeric:result.ideal.value,
        note:"ECM-side generic command representation; frequency and waveform are not inferred."
      };
    }
    if(id==="TP_PWM"){
      if(result.observed===null)return {text:"Actuator-side command unavailable",numeric:null,note:result.note};
      return {
        text:formatVoltage(result.observed)+" avg training math",
        numeric:result.observed,
        note:"Actuator-side modeled command; not a measured test-point voltage."
      };
    }
    return {text:"Unavailable",numeric:null,note:"No modeled display state."};
  }

  function renderTestPoints(result){
    testpointList.replaceChildren();
    const targets=new Set(faultTargets[activeFault]||[]);
    const degraded=activeFault==="FAULT_HIGH_RES_ACT_POWER"||activeFault==="FAULT_HIGH_RES_ACT_GROUND";
    for(const tp of scene.getTestPoints()){
      const display=testPointDisplay(tp.id,result);
      const row=document.createElement("div");
      row.className="testpoint-item"+(targets.has(tp.id)?(degraded?" degraded":" faulted"):"");
      row.dataset.testPointId=tp.id;
      const name=document.createElement("strong");
      name.textContent=tp.id;
      const value=document.createElement("span");
      value.textContent=display.text;
      value.title=display.note;
      row.append(name,value);
      testpointList.append(row);
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
      const hasAsset=scene.isToolEnabled(toolId);
      state.textContent=hasAsset?"Runtime enabled · 3D asset available":"Runtime enabled · no dedicated 3D asset";
      row.append(name,state);
      toolList.append(row);

      const option=document.createElement("option");
      option.value=toolId;
      option.textContent=toolNames[toolId]||toolId;
      activeTool.append(option);
    }
    activeTool.value="tool.dmm";
  }

  function populateProbeTargets(){
    for(const select of [probeRedTarget,probeBlackTarget]){
      select.replaceChildren();
      const blank=document.createElement("option");
      blank.value="";
      blank.textContent="Undocked";
      select.append(blank);
      for(const tp of scene.getTestPoints()){
        const option=document.createElement("option");
        option.value=tp.id;
        option.textContent=tp.label+" ("+tp.terminalId+")";
        select.append(option);
      }
    }
  }

  function renderProbeStatus(){
    const docked=scene.getProbes().filter((p)=>p.dockedTestPointId).map((p)=>{
      const tp=scene.getTestPoint(p.dockedTestPointId);
      return p.label+" → "+(tp?.label||p.dockedTestPointId);
    });
    probeStatus.textContent=docked.length?docked.join("; ")+" — visual docking only.":"No probes docked.";
  }

  function renderToolReading(result){
    const toolId=activeTool.value;
    const red=scene.getProbe("probe.red")?.dockedTestPointId;
    if(toolId==="tool.current-clamp"){
      toolReading.textContent="Current not inferred";
      toolReadingNote.textContent="The Actuator Lab has no authoritative load/current model. Clamp geometry is presentation only.";
      return;
    }
    if(toolId==="tool.scan-tool"){
      toolReading.textContent="No actuator-response PID inferred";
      toolReadingNote.textContent="Duty command does not establish position, speed, force, flow, current, or response.";
      return;
    }
    if(toolId==="tool.oscilloscope"){
      if(!red){
        toolReading.textContent="Dock the red probe at a PWM test point";
        toolReadingNote.textContent="Frequency and waveform shape are not numerically modeled.";
        return;
      }
      if(!["TP_PWM","TP_ECM_PWM"].includes(red)){
        toolReading.textContent="No modeled waveform for this test point";
        toolReadingNote.textContent="The scope does not invent waveform data.";
        return;
      }
      const display=testPointDisplay(red,result);
      toolReading.textContent=display.numeric===null?"PWM unavailable":dutyCycle+"% duty training example";
      toolReadingNote.textContent=display.note+" Frequency remains uninferred.";
      return;
    }
    if(!red){
      toolReading.textContent="Dock the red probe at a declared test point";
      toolReadingNote.textContent="Displayed values are existing modeled training state, not measurements.";
      return;
    }
    const display=testPointDisplay(red,result);
    toolReading.textContent=display.numeric===null?display.text:formatVoltage(display.numeric)+" avg training math";
    toolReadingNote.textContent=display.note;
  }

  async function renderAssets(){
    assetGallery.replaceChildren();
    for(const [index,asset] of scene.getAssets().entries()){
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
      role.textContent=asset.kind==="diagnostic-tool"
        ?"Diagnostic-tool geometry is enabled only when the runtime declares the matching tool. It has no engineering or measurement authority."
        :asset.id==="component.generic-actuator"
          ?"Generic project-authored actuator geometry. It is not a vehicle-specific component model and does not simulate physical response."
          :"Visual scene geometry only; it does not create measurements or engineering state.";

      card.append(head,canvas,status,role);
      assetGallery.append(card);

      if(!asset.enabled)continue;
      const viewer=new Viewer(canvas,status);
      const entry={viewer,asset,index,speed:Number(asset.animation?.speed)||0};
      viewers.push(entry);
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
    const result=renderEngineering();
    renderTestPoints(result);
    renderProbeStatus();
    renderToolReading(result);
  }

  stateSelect.addEventListener("change",()=>{
    operatingState=stateSelect.value;
    dutyCycle=stateDuty.get(operatingState)??0;
    dutyInput.value=String(dutyCycle);
    dutyInputValue.textContent=dutyCycle+"%";
    refresh();
  });
  faultSelect.addEventListener("change",()=>{
    activeFault=faultSelect.value;
    scene.setActiveFault(activeFault||null);
    refresh();
  });
  dutyInput.addEventListener("input",()=>{
    dutyCycle=Number(dutyInput.value);
    dutyInputValue.textContent=dutyCycle+"%";
    refresh();
  });
  activeTool.addEventListener("change",refresh);
  dockRed.addEventListener("click",()=>{
    scene.undockProbe("probe.red");
    if(probeRedTarget.value)scene.dockProbe("probe.red",probeRedTarget.value);
    refresh();
  });
  dockBlack.addEventListener("click",()=>{
    scene.undockProbe("probe.black");
    if(probeBlackTarget.value)scene.dockProbe("probe.black",probeBlackTarget.value);
    refresh();
  });

  try{
    const [runtimeResponse,manifestResponse,circuitResponse,profileResponse]=await Promise.all([
      fetch("/data/architecture/actuator-lab-lmf-runtime.json"),
      fetch("/data/architecture/actuator-lab-3d-assets.json"),
      fetch("/data/circuit-templates/12v-pwm-actuator.json"),
      fetch("/data/engineering/labs/actuator-training.json")
    ]);
    if(!runtimeResponse.ok||!manifestResponse.ok||!circuitResponse.ok||!profileResponse.ok){
      throw new Error("Required Actuator Lab contract could not be loaded.");
    }
    const runtime=await runtimeResponse.json();
    const manifest=await manifestResponse.json();
    circuit=await circuitResponse.json();
    profile=await profileResponse.json();

    scene=new ActuatorLabScene();
    const summary=scene.loadContracts({runtime,manifest,template:circuit,profile});
    supplyVoltage=circuit.voltageSystems.find((system)=>system.id==="LV12").nominalVoltage;
    const dutyRange=profile.actuatorProfile.engineeringProfile.parameters.dutyCycle.range;
    stateDuty=new Map(profile.stateEngineering.map((entry)=>[entry.stateId,entry.dutyCycle.value]));

    if(artifacts){
      const registry=await artifacts.loadRegistry();
      nominalShortGroundArtifact=await artifacts.resolveArtifact(
        registry,
        "actuator.short-ground.nominal30",
        {dutyCyclePercent:30}
      );
    }

    stateSelect.replaceChildren();
    for(const state of circuit.operatingStates){
      const option=document.createElement("option");
      option.value=state.id;
      option.textContent=state.label;
      option.selected=state.id==="pwm-low-example";
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

    dutyInput.min=String(dutyRange.min);
    dutyInput.max=String(dutyRange.max);
    dutyInput.value=String(dutyRange.nominal);
    dutyCycle=dutyRange.nominal;
    dutyInputValue.textContent=dutyCycle+"%";

    renderTools();
    populateProbeTargets();
    governanceBanner.textContent=
      "Presentation-only classroom. All five authority flags are false; "+summary.assetCount+
      " GLB assets are registered, "+summary.enabledToolAssetCount+
      " diagnostic-tool models are runtime-enabled, and engineering state remains owned by the existing Actuator Lab contracts.";

    await renderAssets();
    refresh();
    document.documentElement.dataset.actuatorLab3dClassroom="presentation-only";
  }catch(error){
    console.error(error);
    governanceBanner.textContent="The 3D classroom could not be loaded. The governed 2D Actuator Lab remains available. "+error.message;
  }
})();