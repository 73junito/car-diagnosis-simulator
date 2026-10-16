"use strict";

(async function initSensorLab3dClassroom(){
  const scene3d=document.getElementById("scene3d");
  const webglFallback=document.getElementById("webglFallback");
  const webglStatus=document.getElementById("webglStatus");
  const governanceBanner=document.getElementById("governanceBanner");
  const stateSelect=document.getElementById("stateSelect");
  const faultSelect=document.getElementById("faultSelect");
  const sensorInput=document.getElementById("sensorInput");
  const sensorInputValue=document.getElementById("sensorInputValue");
  const toolList=document.getElementById("toolList");
  const probeRedTarget=document.getElementById("probeRedTarget");
  const probeBlackTarget=document.getElementById("probeBlackTarget");
  const dockRed=document.getElementById("dockRed");
  const dockBlack=document.getElementById("dockBlack");
  const probeStatus=document.getElementById("probeStatus");
  const dmmReading=document.getElementById("dmmReading");
  const dmmSource=document.getElementById("dmmSource");
  const testpointList=document.getElementById("testpointList");
  const sceneFlowNote=document.getElementById("sceneFlowNote");

  const calculator=window.TorqueMindEngineeringCalculator;
  const SensorLabScene=window.AutoLearnProPresentation?.SensorLabScene;
  if(!scene3d||!calculator||!SensorLabScene)return;

  let scene=null;
  let circuit=null;
  let profile=null;
  let signalRange=null;
  let inputRange=null;
  let referenceVoltage=5;
  let operatingState="active-signal";
  let activeFault="";
  let sensorInputPercent=50;
  const testPointEls={};

  const faultToTestPoints={
    FAULT_OPEN_SENSOR_POWER:["TP_SENSOR_SUPPLY"],
    FAULT_OPEN_SENSOR_GROUND:["TP_SENSOR_GROUND"],
    FAULT_OPEN_SIGNAL:["TP_ECM_SIGNAL"],
    FAULT_HIGH_RES_SENSOR_GROUND:["TP_SENSOR_GROUND"],
    FAULT_SIGNAL_SHORT_GROUND:["TP_ECM_SIGNAL"],
    FAULT_SIGNAL_SHORT_POWER:["TP_ECM_SIGNAL"]
  };

  function formatVoltage(value){
    if(value===null||value===undefined)return "—";
    return Number(value.toFixed(3))+" V";
  }

  function currentFaultBehavior(){
    return (profile?.faultBehavior||[]).find((item)=>item.faultId===activeFault)||null;
  }

  function calculateSignalState(){
    const transfer=calculator.calculateLinearTransfer({
      inputPercent:sensorInputPercent,
      outputMin:signalRange.min,
      outputMax:signalRange.max,
      quantityType:"voltage",
      unit:"V"
    });
    const behavior=currentFaultBehavior();
    if(operatingState!=="active-signal"){
      return {transfer,observed:null,status:"inactive",note:"Signal state inactive; controller-observed signal is not evaluated."};
    }
    if(!behavior){
      return {transfer,observed:transfer.value,status:"healthy",note:"Healthy training example."};
    }
    if(behavior.mode==="controller_signal_forced_ground"){
      return {transfer,observed:0,status:"fault",note:behavior.reason};
    }
    if(behavior.mode==="controller_signal_forced_reference"){
      return {transfer,observed:referenceVoltage,status:"fault",note:behavior.reason};
    }
    if(behavior.mode==="controller_signal_unavailable"){
      return {transfer,observed:null,status:"unavailable",note:behavior.reason};
    }
    return {transfer:null,observed:null,status:"unavailable",note:behavior.reason||"Sensor output not inferred."};
  }

  function testPointDisplay(testPointId,state){
    if(testPointId==="TP_SENSOR_SUPPLY"){
      return {available:true,value:referenceVoltage,label:"Sensor reference supply",note:"Generic training reference."};
    }
    if(testPointId==="TP_SENSOR_GROUND"){
      return {available:false,value:null,label:"Sensor ground/reference",note:"No numeric value inferred by the Sensor Lab model"};
    }
    if(testPointId==="TP_SENSOR_SIGNAL"){
      if(!state.transfer){
        return {available:false,value:null,label:"Sensor-side modeled signal",note:state.note};
      }
      return {available:true,value:state.transfer.value,label:"Sensor-side modeled signal",note:"Ideal transfer from the project-authored training profile."};
    }
    if(testPointId==="TP_ECM_SIGNAL"){
      if(state.observed===null){
        return {available:false,value:null,label:"Controller-observed signal",note:state.note};
      }
      return {available:true,value:state.observed,label:"Controller-observed signal",note:"Existing modeled controller-observed state."};
    }
    return {available:false,value:null,label:testPointId,note:"Runtime value unavailable"};
  }

  function renderTools(){
    toolList.replaceChildren();
    for(const asset of scene.getAssets().filter((item)=>item.kind==="diagnostic-tool")){
      const row=document.createElement("div");
      row.className="tool-item "+(asset.enabled?"enabled":"disabled");
      row.dataset.toolId=asset.toolId||"";
      row.dataset.enabled=String(asset.enabled);
      const badge=document.createElement("span");
      badge.className="tool-badge";
      const dot=document.createElement("span");
      dot.className="tool-dot";
      const name=document.createElement("span");
      name.textContent=asset.title;
      const state=document.createElement("span");
      state.textContent=asset.enabled?"Runtime enabled":"Not enabled in Sensor Lab";
      badge.append(dot,name);
      row.append(badge,state);
      toolList.append(row);
    }
  }

  function renderScene(){
    scene3d.replaceChildren();
    const scale=92;
    for(const asset of scene.getAssets()){
      const el=document.createElement("div");
      el.className="asset "+(asset.kind==="diagnostic-tool"?"instrument":"workspace");
      el.dataset.assetId=asset.id;
      el.dataset.enabled=String(asset.enabled);
      el.tabIndex=asset.enabled?0:-1;
      el.setAttribute("aria-label",asset.title+(asset.enabled?"":"; unavailable in this lab"));
      const t=asset.transform;
      el.style.transform=`translate3d(${t.position[0]*scale}px,${t.position[1]*scale}px,${t.position[2]*scale}px) rotateX(${t.rotation[0]}deg) rotateY(${t.rotation[1]}deg) rotateZ(${t.rotation[2]}deg) scale(${t.scale[0]})`;
      if(!asset.enabled)el.style.opacity="0.38";
      const label=document.createElement("div");
      label.className="asset-label";
      label.textContent=asset.title;
      const body=document.createElement("div");
      body.className="asset-body "+(asset.kind==="diagnostic-tool"?"instrument":"workspace");
      body.textContent=asset.title;
      el.append(label,body);
      scene3d.append(el);
    }

    const positions={
      TP_SENSOR_SUPPLY:[0.5,0.7,0.2],
      TP_SENSOR_SIGNAL:[0.55,-0.05,0.2],
      TP_SENSOR_GROUND:[0.45,-0.75,0.2],
      TP_ECM_SIGNAL:[-0.7,-0.05,0.2]
    };
    let index=0;
    for(const tp of scene.getTestPoints()){
      index+=1;
      const el=document.createElement("button");
      el.type="button";
      el.className="asset test-point";
      el.dataset.testPointId=tp.id;
      el.setAttribute("aria-label","Test point "+tp.id+": "+tp.label);
      const p=positions[tp.id]||[0,0,0];
      el.style.transform=`translate3d(${p[0]*scale}px,${p[1]*scale}px,${p[2]*scale}px)`;
      el.innerHTML=`<span class="asset-body test-target" style="width:28px;height:28px;border-radius:50%">●</span><span class="asset-label" style="font-size:.62rem;top:-16px">TP${index}</span>`;
      el.addEventListener("click",()=>{
        probeRedTarget.value=tp.id;
        scene.undockProbe("probe.red");
        scene.dockProbe("probe.red",tp.id);
        refreshAll();
      });
      scene3d.append(el);
      testPointEls[tp.id]=el;
    }
  }

  function renderFault(){
    for(const el of Object.values(testPointEls)){
      el.classList.remove("fault-active","fault-degraded-active");
      el.querySelectorAll(".fault-highlight,.fault-degraded").forEach((node)=>node.remove());
    }
    if(!activeFault)return;
    const degraded=activeFault==="FAULT_HIGH_RES_SENSOR_GROUND";
    for(const testPointId of faultToTestPoints[activeFault]||[]){
      const el=testPointEls[testPointId];
      if(!el)continue;
      const indicator=document.createElement("span");
      indicator.className=degraded?"fault-degraded":"fault-highlight";
      el.append(indicator);
    }
  }

  function renderValues(){
    const state=calculateSignalState();
    sceneFlowNote.textContent=state.note;
    testpointList.replaceChildren();
    for(const tp of scene.getTestPoints()){
      const display=testPointDisplay(tp.id,state);
      const row=document.createElement("div");
      row.className="testpoint-item "+(display.available?"available":"unavailable");
      row.dataset.testPointId=tp.id;
      const name=document.createElement("span");
      name.className="tp-id";
      name.textContent=tp.id;
      const value=document.createElement("span");
      value.className="tp-value";
      value.textContent=display.available?formatVoltage(display.value):display.note;
      row.append(name,value);
      testpointList.append(row);
    }
    renderFault();
    updateDmm(state);
  }

  function updateDmm(state){
    const red=scene.getProbe("probe.red");
    if(!red?.dockedTestPointId){
      dmmReading.textContent="— V";
      dmmSource.textContent="Dock the red probe at a declared test point to display existing modeled state.";
      return;
    }
    const display=testPointDisplay(red.dockedTestPointId,state);
    if(!display.available){
      dmmReading.textContent="— V";
      dmmSource.textContent=display.label+": "+display.note;
      return;
    }
    dmmReading.textContent=formatVoltage(display.value);
    dmmSource.textContent=display.label+": "+formatVoltage(display.value)+" (presentation of existing modeled state)";
  }

  function populateProbeTargets(){
    for(const select of [probeRedTarget,probeBlackTarget]){
      select.replaceChildren();
      const empty=document.createElement("option");
      empty.value="";
      empty.textContent="Undocked";
      select.append(empty);
      for(const tp of scene.getTestPoints()){
        const option=document.createElement("option");
        option.value=tp.id;
        option.textContent=tp.label+" ("+tp.terminalId+")";
        select.append(option);
      }
    }
  }

  function renderProbes(){
    const docked=scene.getProbes().filter((probe)=>probe.dockedTestPointId).map((probe)=>{
      const tp=scene.getTestPoint(probe.dockedTestPointId);
      return probe.label+" → "+(tp?.label||probe.dockedTestPointId);
    });
    probeStatus.textContent=docked.length?docked.join("; ")+" — visual selection only; no measurement is generated.":"No probes docked.";
  }

  function refreshAll(){
    renderScene();
    renderTools();
    renderValues();
    renderProbes();
  }

  stateSelect.addEventListener("change",()=>{operatingState=stateSelect.value;refreshAll();});
  faultSelect.addEventListener("change",()=>{activeFault=faultSelect.value;scene.setActiveFault(activeFault||null);refreshAll();});
  sensorInput.addEventListener("input",()=>{sensorInputPercent=Number(sensorInput.value);sensorInputValue.textContent=sensorInputPercent+"%";refreshAll();});
  dockRed.addEventListener("click",()=>{scene.undockProbe("probe.red");if(probeRedTarget.value)scene.dockProbe("probe.red",probeRedTarget.value);refreshAll();});
  dockBlack.addEventListener("click",()=>{scene.undockProbe("probe.black");if(probeBlackTarget.value)scene.dockProbe("probe.black",probeBlackTarget.value);refreshAll();});

  document.addEventListener("keydown",(event)=>{
    const testPoints=scene?.getTestPoints()||[];
    const current=testPoints.findIndex((tp)=>document.activeElement===testPointEls[tp.id]);
    if(current<0)return;
    let next=current;
    if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(current+1)%testPoints.length;
    else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(current-1+testPoints.length)%testPoints.length;
    else return;
    event.preventDefault();
    testPointEls[testPoints[next].id]?.focus();
  });

  try{
    const [runtimeResponse,manifestResponse,circuitResponse,profileResponse]=await Promise.all([
      fetch("/data/architecture/sensor-lab-lmf-runtime.json"),
      fetch("/data/architecture/sensor-lab-3d-assets.json"),
      fetch("/data/circuit-templates/12v-three-wire-sensor.json"),
      fetch("/data/engineering/labs/sensor-training.json")
    ]);
    if(!runtimeResponse.ok||!manifestResponse.ok||!circuitResponse.ok||!profileResponse.ok){
      throw new Error("Required Sensor Lab contract could not be loaded.");
    }
    const runtime=await runtimeResponse.json();
    const manifest=await manifestResponse.json();
    circuit=await circuitResponse.json();
    profile=await profileResponse.json();

    scene=new SensorLabScene();
    const summary=scene.loadContracts({runtime,manifest,template:circuit,profile});
    signalRange=profile.sensorProfile.engineeringProfile.parameters.signalRange.range;
    inputRange=profile.sensorProfile.engineeringProfile.parameters.normalizedInput.range;
    referenceVoltage=circuit.voltageSystems.find((item)=>item.id==="SENSOR5").nominalVoltage;

    governanceBanner.textContent="Presentation-only classroom. Engineering authority remains with the existing Sensor Lab contracts; all 3D authority flags are false.";
    webglStatus.textContent=summary.webglSupported?"WebGL available. Existing GLB assets remain available through the governed Sensor Lab 3D presentation layer.":"WebGL unavailable. This page keeps the classroom controls and 2D presentation fallback available.";
    webglStatus.className="webgl-status "+(summary.webglSupported?"ok":"fallback");
    webglFallback.hidden=summary.webglSupported;
    webglFallback.setAttribute("aria-hidden",String(summary.webglSupported));

    stateSelect.replaceChildren();
    for(const state of circuit.operatingStates){
      const option=document.createElement("option");
      option.value=state.id;
      option.textContent=state.label;
      option.selected=state.id==="active-signal";
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
    sensorInput.min=String(inputRange.min);
    sensorInput.max=String(inputRange.max);
    sensorInput.value=String(inputRange.nominal);
    sensorInputPercent=inputRange.nominal;
    sensorInputValue.textContent=sensorInputPercent+"%";
    populateProbeTargets();
    refreshAll();
    document.documentElement.dataset.sensorLab3dClassroom="presentation-only";
  }catch(error){
    console.error(error);
    governanceBanner.textContent="The 3D classroom could not be loaded. The governed 2D Sensor Lab remains available.";
    webglStatus.textContent=error.message;
    webglStatus.className="webgl-status fallback";
    webglFallback.hidden=false;
    webglFallback.setAttribute("aria-hidden","false");
  }
})();