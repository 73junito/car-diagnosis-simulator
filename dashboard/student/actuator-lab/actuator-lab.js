"use strict";
(async function initActuatorLab(){
 const NS="http://www.w3.org/2000/svg";
 const [templateResponse,engineeringResponse,symbolLibrary,connectionLibrary]=await Promise.all([
  fetch("/data/circuit-templates/12v-pwm-actuator.json"),
  fetch("/data/engineering/labs/actuator-training.json"),
  window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols"),
  window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections")
 ]);
 if(!templateResponse.ok) throw new Error("Unable to load actuator template.");
 if(!engineeringResponse.ok) throw new Error("Unable to load actuator engineering profile.");
 const circuit=await templateResponse.json();
 const engineeringProfile=await engineeringResponse.json();
 const engine=window.TorqueMindCircuitEngine;
 const validation=window.TorqueMindCircuitTemplateContracts.validateCircuitTemplate(circuit,engine,symbolLibrary.registry,connectionLibrary.registry);
 if(!validation.valid) throw new Error(validation.errors.join("; "));
 const svg=document.getElementById("circuitSvg"), inspector=document.getElementById("inspectorContent");
 const stateSelect=document.getElementById("stateSelect"), faultSelect=document.getElementById("faultSelect");
 const stateBadge=document.getElementById("stateBadge"), flowNote=document.getElementById("flowNote"), voltageProfile=document.getElementById("voltageProfile");
 const symbolRenderer=window.TorqueMindSymbolRenderer, voltageDomains=window.TorqueMindVoltageDomains;
 const engineering=window.TorqueMindEngineering, calculator=engineering.calculator, measurements=engineering.measurements;
 const actuatorProfile=engineeringProfile.actuatorProfile.engineeringProfile;
 const engineeringErrors=engineering.profiles.validateEngineeringProfile(actuatorProfile);
 if(engineeringErrors.length) throw new Error(engineeringErrors.join("; "));
 const voltageArchitecture=voltageDomains.describeVoltageArchitecture(circuit);
 const voltageDomainById=new Map(voltageArchitecture.map(d=>[d.id,d]));
 for(const d of voltageArchitecture){
  const chip=document.createElement("span"); chip.className=`voltage-chip voltage-domain-${d.domainClass}`; chip.dataset.voltageSystemId=d.id;
  const small=document.createElement("small"); small.textContent=d.powertrainLabel;
  const value=document.createElement("span"); value.textContent=d.label; chip.append(small,value); voltageProfile.append(chip);
 }
 for(const s of circuit.operatingStates){const o=document.createElement("option");o.value=s.id;o.textContent=s.label;if(s.id==="pwm-low-example")o.selected=true;stateSelect.append(o);}
 for(const f of circuit.faultCatalog){const o=document.createElement("option");o.value=f.id;o.textContent=f.label;faultSelect.append(o);}
 const componentById=new Map(circuit.components.map(c=>[c.id,c])), terminalOwner=new Map();
 for(const c of circuit.components) for(const t of c.terminals) terminalOwner.set(t.id,c.id);
 let operatingState=stateSelect.value,activeFault="",selectedComponentId="",flowMode="system";
 const roleText={
  BAT1:"12 V nominal source for this generic training circuit.",
  FUSE1:"Generic protection for the actuator power path.",
  ECM1:"Controller providing a separate PWM command while also requiring its own power and ground.",
  ACT1:"Generic three-wire actuator with distinct power, PWM command, and ground terminals.",
  GND1:"Common chassis return reference."
 };
 const engineeringUi={
  status:document.getElementById("actuatorEngineeringStatus"),
  dutyInput:document.getElementById("dutyInput"),
  dutyInputValue:document.getElementById("dutyInputValue"),
  supply:document.getElementById("engActuatorSupply"),
  duty:document.getElementById("engDutyCycle"),
  idealAverage:document.getElementById("engIdealAverage"),
  observed:document.getElementById("engObservedCommand"),
  observedLabel:document.getElementById("engObservedCommandLabel"),
  power:document.getElementById("engPowerAvailability"),
  ground:document.getElementById("engGroundAvailability"),
  measuredAverage:document.getElementById("measuredActuatorAverage"),
  measuredResult:document.getElementById("actuatorMeasurementResult"),
  formula:document.getElementById("actuatorEngineeringFormula")
 };
 const supplyVoltage=circuit.voltageSystems.find(system=>system.id==="LV12").nominalVoltage;
 const dutyRange=actuatorProfile.parameters.dutyCycle.range;
 const stateDuty=new Map(engineeringProfile.stateEngineering.map(entry=>[entry.stateId,entry.dutyCycle.value]));
 let dutyCycle=stateDuty.get(operatingState)??dutyRange.nominal;
 engineeringUi.dutyInput.min=String(dutyRange.min);
 engineeringUi.dutyInput.max=String(dutyRange.max);
 engineeringUi.dutyInput.value=String(dutyCycle);

 function formatVoltage(value){return `${Number(value.toFixed(3))} V`;}
 function faultBehavior(){return engineeringProfile.faultBehavior.find(item=>item.faultId===activeFault)||null;}
 function actuatorCommandActive(){return operatingState==="pwm-low-example"||operatingState==="pwm-high-example";}
 function engineeringState(){
  const ideal=calculator.calculatePwmAverage({highVoltage:supplyVoltage,dutyCyclePercent:dutyCycle});
  const behavior=faultBehavior();
  let observed=actuatorCommandActive()?ideal.value:null;
  let status=actuatorCommandActive()?"Healthy training example":"PWM command inactive";
  let statusClass=actuatorCommandActive()?"":"inactive";
  let power="Available",ground="Available",note="The actuator-side command follows the generic PWM command representation.";
  if(operatingState==="key-off"){power="Inactive";ground="Inactive";}
  if(!actuatorCommandActive()) note="No active PWM command is shown in this operating state.";
  if(behavior){
   statusClass="fault";
   if(behavior.mode==="actuator_command_unavailable"){observed=null;status="Actuator-side PWM unavailable";}
   if(behavior.mode==="actuator_command_forced_ground"){observed=0;status="PWM short-to-ground training fault";}
   if(behavior.mode==="actuator_command_forced_power"){observed=supplyVoltage;status="PWM short-to-power training fault";}
   if(behavior.mode==="actuator_power_unavailable"){power="Unavailable";status="Actuator power unavailable";}
   if(behavior.mode==="actuator_ground_unavailable"){ground="Unavailable";status="Actuator ground unavailable";}
   if(behavior.mode==="actuator_power_degraded"){power="Degraded";status="Actuator power path degraded";}
   if(behavior.mode==="actuator_ground_degraded"){ground="Degraded";status="Actuator ground path degraded";}
   note=behavior.reason;
  }
  return{ideal,observed,status,statusClass,power,ground,note};
 }
 function renderEngineering(){
  const result=engineeringState();
  const measuredRaw=engineeringUi.measuredAverage.value.trim();
  if(!measuredRaw){
   engineeringUi.measuredResult.textContent="No measurement entered";
   engineeringUi.measuredResult.className="measurement-result";
  } else {
   const measuredValue=Number(measuredRaw);
   if(Number.isFinite(measuredValue)){
    const measured=measurements.createMeasuredQuantity({
     quantityType:"voltage",unit:"V",value:measuredValue,
     labId:"actuator-lab",measurementId:"pwm-average"
    });
    const delta=measurements.deltaBetween(measured,result.ideal);
    engineeringUi.measuredResult.textContent=`Recorded ${formatVoltage(measured.value)}; Δ vs training ideal ${delta>=0?"+":""}${delta.toFixed(3)} V`;
   } else {
    engineeringUi.measuredResult.textContent="Enter a finite voltage value";
   }
   engineeringUi.measuredResult.className="measurement-result";
  }
  engineeringUi.dutyInputValue.textContent=`${dutyCycle}%`;
  engineeringUi.supply.textContent=`${supplyVoltage} V`;
  engineeringUi.duty.textContent=`${dutyCycle}%`;
  engineeringUi.idealAverage.textContent=formatVoltage(result.ideal.value);
  engineeringUi.observed.textContent=result.observed===null?"—":`${formatVoltage(result.observed)} avg`;
  engineeringUi.observedLabel.textContent=result.observed===null?"Actuator-side command unavailable / inactive":"PWM command representation";
  engineeringUi.power.textContent=result.power;
  engineeringUi.ground.textContent=result.ground;
  engineeringUi.status.textContent=result.status;
  engineeringUi.status.className=["engineering-status",result.statusClass].filter(Boolean).join(" ");
  engineeringUi.formula.textContent=`Mathematical training representation: Vavg = ${supplyVoltage} V × (${dutyCycle}% ÷ 100) = ${formatVoltage(result.ideal.value)}. ${result.note} This average does not define actuator response or meter/oscilloscope behavior for every PWM circuit.`;
 }
 function el(name,attrs={},text=""){const n=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;}
 function stateDef(){return circuit.operatingStates.find(s=>s.id===operatingState);}
 function faultObj(){return activeFault?engine.getFault(circuit,activeFault):null;}
 function pointForTerminal(id){
  const owner=terminalOwner.get(id), c=componentById.get(owner), pos=circuit.layout.positions[owner], td=c.terminals.find(t=>t.id===id);
  const symbol=symbolLibrary.registry.get(c.symbolId), st=symbol.terminals.find(t=>t.id===td.symbolTerminalId);
  if(!st) throw new Error(`Missing symbol terminal for ${id}`);
  return{x:pos.x-50+st.x,y:pos.y-50+st.y};
 }
 function routePath(connection){
  const a=pointForTerminal(connection.from),b=pointForTerminal(connection.to);
  if(["W_ACT_GND","W_ECM_GND","W_BAT_GND"].includes(connection.id)){const railY=connection.id==="W_ACT_GND"?520:565;return`M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;}
  if(connection.id==="W_BAT_ECM") return`M ${a.x} ${a.y} V 150 H ${b.x}`;
  if(connection.id==="W_ECM_PWM") return`M ${a.x} ${a.y} H 585 V ${b.y} H ${b.x}`;
  const mid=Math.round((a.x+b.x)/2);return`M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}`;
 }
 function addDefs(){
  const defs=el("defs");
  for(const[id,color]of[["arrow-power","#c62828"],["arrow-ground","#20252d"],["arrow-control","#1565c0"],["arrow-fault","#ef6c00"]]){
   const m=el("marker",{id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"});
   m.append(el("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:color}));defs.append(m);
  } svg.append(defs);
 }
 function selectedFlows(){
  const f=stateDef().activeFlows;if(flowMode==="system")return f;
  return{power:flowMode==="power"?f.power:[],ground:flowMode==="ground"?f.ground:[],control:flowMode==="control"?f.control:[]};
 }
 function flowMap(){const m=new Map(),f=selectedFlows();for(const[id,d]of f.power||[])m.set(id,{kind:"power",direction:d});for(const[id,d]of f.ground||[])m.set(id,{kind:"ground",direction:d});for(const[id,d]of f.control||[])m.set(id,{kind:"control",direction:d});return m;}
 function flowAllowed(id){const f=faultObj();return !(f&&f.type==="open_circuit"&&f.targetConnectionId===id);}
 function renderWires(){
  const current=flowMap(),fault=faultObj();
  for(const c of circuit.connections){
   const flow=current.get(c.id),style=connectionLibrary.registry.get(c.styleId),domain=voltageDomainById.get(c.voltageSystemId);
   const isShort=fault?.targetConnectionId===c.id&&(fault.type==="short_to_ground"||fault.type==="short_to_power");
   const p=el("path",{d:routePath(c),class:[
    "wire",`wire-role-${style.strokeRole}`,`voltage-domain-${domain.domainClass}`,c.type.replaceAll("_","-"),
    flow&&flowAllowed(c.id)?`flow-${flow.kind}`:"",flow?.direction==="reverse"?"reverse":"",
    fault?.targetConnectionId===c.id&&fault.type==="open_circuit"?"fault-open":"",
    fault?.targetConnectionId===c.id&&fault.type==="high_resistance"?"fault-degraded":"",
    isShort?"fault-short":""
   ].filter(Boolean).join(" "),style:`--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern||"none"}`,
   "data-connection-id":c.id,"data-style-id":c.styleId,"data-voltage-system-id":c.voltageSystemId});
   if(flow&&flowAllowed(c.id)){const marker=flow.kind==="power"?"arrow-power":flow.kind==="ground"?"arrow-ground":"arrow-control";p.setAttribute(flow.direction==="reverse"?"marker-start":"marker-end",`url(#${marker})`);}
   else if(fault?.targetConnectionId===c.id)p.setAttribute("marker-end","url(#arrow-fault)");
   svg.append(p);
  }
  if(fault&&(fault.type==="short_to_ground"||fault.type==="short_to_power")){
   const a=pointForTerminal(fault.targetTerminalId),b=pointForTerminal(fault.shortTargetTerminalId);
   svg.append(el("path",{d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,class:"wire fault-short","data-fault-short-id":fault.id}));
  }
 }
 function renderComponents(){
  for(const c of circuit.components){
   const pos=circuit.layout.positions[c.id],group=el("g",{class:["component",selectedComponentId===c.id?"selected":""].filter(Boolean).join(" "),tabindex:"0",role:"button","aria-label":c.name,"data-component-id":c.id});
   group.append(el("rect",{x:pos.x-72,y:pos.y-68,width:144,height:144,rx:12,class:"hit-target"}));
   const s=symbolLibrary.registry.get(c.symbolId);symbolRenderer.renderSymbol(group,s,{x:pos.x-50,y:pos.y-50,scale:1,className:"component-library-symbol",role:"presentation",ariaLabel:s.name});
   group.addEventListener("click",()=>inspect(c.id));svg.append(group);
  }
 }
 function renderLabels(){
  for(const c of circuit.components){const l=circuit.labels[c.id],pos=circuit.layout.positions[c.id];if(!l)continue;const cx=l.x+l.width/2,cy=l.y+l.height/2,g=el("g",{class:"component-label","aria-hidden":"true"});
   g.append(el("path",{d:`M ${pos.x} ${pos.y} L ${cx} ${cy}`,class:"label-leader"}));g.append(el("rect",{x:l.x,y:l.y,width:l.width,height:l.height,rx:8,class:"label-chip"}));g.append(el("text",{x:cx,y:l.y+20,class:"label-title"},l.title));g.append(el("text",{x:cx,y:l.y+38,class:"label-subtitle"},l.subtitle));svg.append(g);}
 }
 function renderTestPoints(){circuit.testPoints.forEach((tp,index)=>{const p=pointForTerminal(tp.terminalId),dx=index%2===0?28:-28,dy=index%2===0?-22:22,bx=p.x+dx,by=p.y+dy,g=el("g",{class:"test-point",role:"button",tabindex:"0","aria-label":`Test point ${index+1}: ${tp.id}`,"data-test-point-id":tp.id});g.append(el("circle",{cx:p.x,cy:p.y,r:6}));g.append(el("line",{x1:p.x,y1:p.y,x2:bx,y2:by,class:"label-leader"}));g.append(el("rect",{x:bx-18,y:by-11,width:36,height:22,rx:7,class:"tp-badge"}));g.append(el("text",{x:bx,y:by+1,class:"tp-label"},`TP${index+1}`));g.addEventListener("click",()=>inspectTestPoint(tp));svg.append(g);});}
 function render(){svg.querySelectorAll("*:not(title):not(desc)").forEach(n=>n.remove());addDefs();renderWires();renderComponents();renderLabels();renderTestPoints();renderEngineering();stateBadge.textContent=stateDef().label;flowNote.textContent=stateDef().note+" Animated arrows are conceptual and do not represent measured magnitude.";}
 function inspect(id){selectedComponentId=id;const c=componentById.get(id),points=engine.getAvailableTestPoints(circuit,id);inspector.replaceChildren();const h=document.createElement("h3");h.textContent=c.name;const p=document.createElement("p");p.textContent=roleText[id]||"Reusable training component.";const dl=document.createElement("dl");for(const[label,value]of[["Library symbol",c.symbolId],["Voltage domain",c.voltageSystemId],["Terminals",c.terminals.map(t=>t.name).join(", ")],["Test points",points.length?points.map(x=>x.id).join(", "):"None"]]){const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}inspector.append(h,p,dl);render();}
 function inspectTestPoint(tp){inspector.replaceChildren();const h=document.createElement("h3"),p=document.createElement("p");h.textContent=tp.id;p.textContent=`Available conceptual measurements: ${tp.measurementTypes.join(", ")}. Vehicle-specific values and limits are intentionally omitted.`;inspector.append(h,p);}
 stateSelect.addEventListener("change",()=>{operatingState=stateSelect.value;dutyCycle=stateDuty.get(operatingState)??0;engineeringUi.dutyInput.value=String(dutyCycle);flowMode="system";render();});
 faultSelect.addEventListener("change",()=>{activeFault=faultSelect.value;render();});
 const updateDutyFromControl=()=>{dutyCycle=Number(engineeringUi.dutyInput.value);renderEngineering();};
 engineeringUi.dutyInput.addEventListener("input",updateDutyFromControl);
 engineeringUi.dutyInput.addEventListener("change",updateDutyFromControl);
 engineeringUi.measuredAverage.addEventListener("input",renderEngineering);
 engineeringUi.measuredAverage.addEventListener("change",renderEngineering);
 document.getElementById("showSystemFlow").addEventListener("click",()=>{flowMode="system";render();});
 document.getElementById("tracePower").addEventListener("click",()=>{flowMode="power";render();});
 document.getElementById("tracePwm").addEventListener("click",()=>{flowMode="control";render();});
 document.getElementById("traceGround").addEventListener("click",()=>{flowMode="ground";render();});
 document.getElementById("resetView").addEventListener("click",()=>{operatingState="pwm-low-example";stateSelect.value=operatingState;dutyCycle=stateDuty.get(operatingState);engineeringUi.dutyInput.value=String(dutyCycle);activeFault="";faultSelect.value="";selectedComponentId="";flowMode="system";inspector.innerHTML="<p>Select a symbol or test point to inspect its role.</p>";render();});
 render();
})().catch(error=>{console.error(error);const t=document.getElementById("inspectorContent");if(t)t.textContent="The actuator template could not be loaded.";});
