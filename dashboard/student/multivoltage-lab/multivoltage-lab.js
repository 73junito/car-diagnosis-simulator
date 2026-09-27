"use strict";

(async function initMultiVoltageLab(){
  const NS="http://www.w3.org/2000/svg";
  const [templateResponse,symbolLibrary,connectionLibrary]=await Promise.all([
    fetch("/data/circuit-templates/electrified-multivoltage.json"),
    window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols"),
    window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections")
  ]);
  if(!templateResponse.ok) throw new Error("Unable to load multi-voltage template.");

  const circuit=await templateResponse.json();
  const engine=window.TorqueMindCircuitEngine;
  const validation=window.TorqueMindCircuitTemplateContracts.validateCircuitTemplate(
    circuit,engine,symbolLibrary.registry,connectionLibrary.registry
  );
  if(!validation.valid) throw new Error(validation.errors.join("; "));

  const svg=document.getElementById("circuitSvg");
  const inspector=document.getElementById("inspectorContent");
  const stateSelect=document.getElementById("stateSelect");
  const faultSelect=document.getElementById("faultSelect");
  const stateBadge=document.getElementById("stateBadge");
  const flowNote=document.getElementById("flowNote");
  const voltageProfile=document.getElementById("voltageProfile");
  const symbolRenderer=window.TorqueMindSymbolRenderer;
  const engineering=window.TorqueMindEngineering;
  const calculator=engineering.calculator;
  const measurements=engineering.measurements;

  const voltageArchitecture=window.TorqueMindVoltageDomains.describeVoltageArchitecture(circuit);
  const voltageDomainById=new Map(voltageArchitecture.map((domain)=>[domain.id,domain]));

  for(const domain of voltageArchitecture){
    const chip=document.createElement("span");
    chip.className=`voltage-chip voltage-domain-${domain.domainClass}`;
    chip.dataset.voltageSystemId=domain.id;
    const small=document.createElement("small");
    small.textContent=domain.powertrainLabel;
    const value=document.createElement("span");
    value.textContent=domain.label;
    chip.append(small,value);
    voltageProfile.append(chip);
  }

  for(const state of circuit.operatingStates){
    const option=document.createElement("option");
    option.value=state.id;
    option.textContent=state.label;
    if(state.id==="traction-drive-example") option.selected=true;
    stateSelect.append(option);
  }
  for(const fault of circuit.faultCatalog){
    const option=document.createElement("option");
    option.value=fault.id;
    option.textContent=fault.label;
    faultSelect.append(option);
  }

  const componentById=new Map(circuit.components.map((component)=>[component.id,component]));
  const terminalOwner=new Map();
  for(const component of circuit.components){
    for(const terminal of component.terminals) terminalOwner.set(terminal.id,component.id);
  }

  let operatingState=stateSelect.value;
  let activeFault="";
  let selectedComponentId="";
  let flowMode="system";

  const roleText={
    BAT12:"Low-voltage battery in the declared 12 V domain.",
    FUSE12:"Generic protection on the low-voltage branch.",
    CTRL1:"Low-voltage controller that remains electrically separate from the traction-power path.",
    LVGND:"Chassis/reference ground for the 12 V domain only.",
    HVBAT:"Traction battery shown at 400 V nominal as a training example only.",
    DCDC1:"Cross-domain training component showing the relationship between traction-domain input and a separate low-voltage output.",
    INV1:"Generic traction inverter between the traction battery and motor. Internal switching behavior is intentionally not modeled.",
    MOTOR1:"Generic traction motor shown only as the conceptual traction-system load."
  };

  const engineeringUi={
    status:document.getElementById("multiVoltageEngineeringStatus"),
    domainSelect:document.getElementById("engineeringDomainSelect"),
    currentInput:document.getElementById("domainCurrentInput"),
    voltage:document.getElementById("engDomainVoltage"),
    voltageLabel:document.getElementById("engDomainVoltageLabel"),
    current:document.getElementById("engDomainCurrent"),
    power:document.getElementById("engDomainPower"),
    role:document.getElementById("engDomainRole"),
    boundary:document.getElementById("engDomainBoundary"),
    formula:document.getElementById("multiVoltageEngineeringFormula")
  };

  function enteredCurrent(){
    const raw=engineeringUi.currentInput.value.trim();
    if(!raw) return null;
    const value=Number(raw);
    if(!Number.isFinite(value)||value<=0) return null;
    return measurements.createMeasuredQuantity({
      quantityType:"current",unit:"A",value,
      labId:"multivoltage-lab",measurementId:"domain-current"
    });
  }

  function selectedDomain(){
    return circuit.voltageSystems.find((domain)=>domain.id===engineeringUi.domainSelect.value)||circuit.voltageSystems[0];
  }

  function domainIsActive(domainId){
    const flows=currentState().activeFlows||{};
    if(domainId==="LV12") return Boolean((flows.lvPower||[]).length||(flows.lvGround||[]).length||(flows.control||[]).length);
    if(domainId==="TR400") return Boolean((flows.traction||[]).length||(flows.tractionReturn||[]).length);
    return false;
  }

  function selectedDomainFault(){
    const fault=currentFault();
    if(!fault) return null;
    const connection=circuit.connections.find((item)=>item.id===fault.targetConnectionId);
    return connection?.voltageSystemId===engineeringUi.domainSelect.value ? fault : null;
  }

  function renderEngineering(){
    const domain=selectedDomain();
    const current=enteredCurrent();
    const power=current ? calculator.calculatePower({voltage:domain.nominalVoltage,current:current.value}) : null;
    const domainFault=selectedDomainFault();
    const active=domainIsActive(domain.id);

    engineeringUi.voltage.textContent=`${domain.nominalVoltage} V`;
    engineeringUi.voltageLabel.textContent=domain.id==="TR400" ? "Traction training example" : "Low-voltage domain";
    engineeringUi.current.textContent=current ? `${Number(current.value.toFixed(2))} A` : "—";
    engineeringUi.power.textContent=power
      ? (power.value>=1000 ? `${(power.value/1000).toFixed(3)} kW` : `${Number(power.value.toFixed(2))} W`)
      : "—";
    engineeringUi.role.textContent=domain.id;
    engineeringUi.boundary.textContent=domain.id==="TR400"
      ? "400 V is a declared training example, not a universal traction voltage"
      : "Declared 12 V training domain";

    if(domainFault?.type==="open_circuit"){
      engineeringUi.status.textContent="Selected-domain path open — entered current is not inferred from the fault";
      engineeringUi.status.className="engineering-status fault";
    } else if(domainFault?.type==="high_resistance"){
      engineeringUi.status.textContent="Selected-domain path degraded — no fault current or power inferred";
      engineeringUi.status.className="engineering-status fault";
    } else if(!active){
      engineeringUi.status.textContent=current
        ? "Domain inactive in this state — entered current is calculation input only"
        : "Domain inactive; current not entered";
      engineeringUi.status.className="engineering-status inactive";
    } else if(!current){
      engineeringUi.status.textContent="Current not entered";
      engineeringUi.status.className="engineering-status";
    } else {
      engineeringUi.status.textContent="Calculated from declared voltage and entered current";
      engineeringUi.status.className="engineering-status";
    }

    const voltageBoundary=domain.id==="TR400"
      ? "The 400 V value belongs only to this project-authored training example."
      : "The 12 V value is the declared low-voltage architecture for this training template.";
    const calculation=current
      ? `P = ${domain.nominalVoltage} V × measured ${Number(current.value.toFixed(2))} A = ${power.value.toFixed(2)} W.`
      : "Enter a positive current to calculate power.";
    const faultText=domainFault
      ? " The injected fault does not create a measured current, voltage, power, converter-efficiency, or motor-output value."
      : "";
    engineeringUi.formula.textContent=`${voltageBoundary} ${calculation} This calculation does not imply DC/DC conversion ratio, efficiency, inverter switching behavior, traction-motor torque, or vehicle-specific operating limits.${faultText}`;
  }

  function el(name,attrs={},text=""){
    const node=document.createElementNS(NS,name);
    for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
    if(text) node.textContent=text;
    return node;
  }

  function currentState(){
    return circuit.operatingStates.find((state)=>state.id===operatingState);
  }

  function currentFault(){
    return activeFault ? engine.getFault(circuit,activeFault) : null;
  }

  function pointForTerminal(terminalId){
    const ownerId=terminalOwner.get(terminalId);
    const component=componentById.get(ownerId);
    const pos=circuit.layout.positions[ownerId];
    const terminal=component.terminals.find((item)=>item.id===terminalId);
    const symbol=symbolLibrary.registry.get(component.symbolId);
    const symbolTerminal=symbol.terminals.find((item)=>item.id===terminal.symbolTerminalId);
    if(!symbolTerminal) throw new Error(`Missing symbol terminal mapping for ${terminalId}`);
    return {x:pos.x-50+symbolTerminal.x,y:pos.y-50+symbolTerminal.y};
  }

  function routePath(connection){
    const a=pointForTerminal(connection.from);
    const b=pointForTerminal(connection.to);

    if(["W_CTRL_GND","W_LV_BAT_GND","W_DCDC_LV_NEG"].includes(connection.id)){
      const railY=connection.id==="W_DCDC_LV_NEG" ? 375 : 330;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }
    if(connection.id==="W_DCDC_LV_POS"){
      return `M ${a.x} ${a.y} V 265 H ${b.x} V ${b.y}`;
    }
    if(connection.id==="W_CTRL_INV"){
      return `M ${a.x} ${a.y} H 530 V ${b.y} H ${b.x}`;
    }
    if(["W_HV_INV_POS","W_HV_INV_NEG"].includes(connection.id)){
      const railY=connection.id==="W_HV_INV_POS" ? 470 : 535;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }
    if(["W_HV_DCDC_POS","W_HV_DCDC_NEG"].includes(connection.id)){
      const railY=connection.id==="W_HV_DCDC_POS" ? 455 : 565;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }
    if(["W_INV_MOTOR_A","W_INV_MOTOR_B"].includes(connection.id)){
      const railY=connection.id==="W_INV_MOTOR_A" ? 400 : 445;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }

    const midX=Math.round((a.x+b.x)/2);
    return `M ${a.x} ${a.y} H ${midX} V ${b.y} H ${b.x}`;
  }

  function renderDomainZones(){
    svg.append(el("rect",{x:8,y:8,width:884,height:365,rx:16,class:"domain-zone lv"}));
    svg.append(el("text",{x:28,y:34,class:"domain-zone-title"},"LOW-VOLTAGE DOMAIN"));
    svg.append(el("text",{x:28,y:54,class:"domain-zone-subtitle"},"12 V nominal"));

    svg.append(el("rect",{x:8,y:385,width:884,height:267,rx:16,class:"domain-zone traction"}));
    svg.append(el("text",{x:28,y:412,class:"domain-zone-title"},"TRACTION DOMAIN — TRAINING EXAMPLE"));
    svg.append(el("text",{x:28,y:432,class:"domain-zone-subtitle"},"400 V nominal example only"));
  }

  function addDefs(){
    const defs=el("defs");
    for(const [id,color] of [
      ["arrow-lv-power","#c62828"],
      ["arrow-lv-ground","#20252d"],
      ["arrow-control","#1565c0"],
      ["arrow-traction","#a54b00"],
      ["arrow-traction-return","#6f4f2f"],
      ["arrow-fault","#ef6c00"]
    ]){
      const marker=el("marker",{id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"});
      marker.append(el("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:color}));
      defs.append(marker);
    }
    svg.append(defs);
  }

  function selectedFlows(){
    const flows=currentState().activeFlows;
    if(flowMode==="system") return flows;
    if(flowMode==="lv"){
      return {lvPower:flows.lvPower||[],lvGround:flows.lvGround||[],control:[],traction:[],tractionReturn:[]};
    }
    if(flowMode==="control"){
      return {lvPower:[],lvGround:[],control:flows.control||[],traction:[],tractionReturn:[]};
    }
    if(flowMode==="traction"){
      return {lvPower:[],lvGround:[],control:[],traction:flows.traction||[],tractionReturn:flows.tractionReturn||[]};
    }
    if(flowMode==="dcdc"){
      const ids=new Set(["W_DCDC_LV_POS","W_DCDC_LV_NEG","W_HV_DCDC_POS","W_HV_DCDC_NEG"]);
      const filter=(items)=>(items||[]).filter(([id])=>ids.has(id));
      return {
        lvPower:filter(flows.lvPower),
        lvGround:filter(flows.lvGround),
        control:[],
        traction:filter(flows.traction),
        tractionReturn:filter(flows.tractionReturn)
      };
    }
    return flows;
  }

  function flowMap(){
    const map=new Map();
    const flows=selectedFlows();
    for(const [id,direction] of flows.lvPower||[]) map.set(id,{kind:"lv-power",direction});
    for(const [id,direction] of flows.lvGround||[]) map.set(id,{kind:"lv-ground",direction});
    for(const [id,direction] of flows.control||[]) map.set(id,{kind:"control",direction});
    for(const [id,direction] of flows.traction||[]) map.set(id,{kind:"traction",direction});
    for(const [id,direction] of flows.tractionReturn||[]) map.set(id,{kind:"traction-return",direction});
    return map;
  }

  function flowAllowed(connectionId){
    const fault=currentFault();
    return !(fault && fault.type==="open_circuit" && fault.targetConnectionId===connectionId);
  }

  function renderWires(){
    const current=flowMap();
    const fault=currentFault();

    for(const connection of circuit.connections){
      const flow=current.get(connection.id);
      const style=connectionLibrary.registry.get(connection.styleId);
      const domain=voltageDomainById.get(connection.voltageSystemId);
      const path=el("path",{
        d:routePath(connection),
        class:[
          "wire",
          `wire-role-${style.strokeRole}`,
          `voltage-domain-${domain.domainClass}`,
          connection.type.replaceAll("_","-").toLowerCase(),
          flow && flowAllowed(connection.id) ? `flow-${flow.kind}` : "",
          flow?.direction==="reverse" ? "reverse" : "",
          fault?.targetConnectionId===connection.id && fault.type==="open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId===connection.id && fault.type==="high_resistance" ? "fault-degraded" : ""
        ].filter(Boolean).join(" "),
        style:`--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern||"none"}`,
        "data-connection-id":connection.id,
        "data-style-id":connection.styleId,
        "data-voltage-system-id":connection.voltageSystemId
      });

      if(flow && flowAllowed(connection.id)){
        const marker={
          "lv-power":"arrow-lv-power",
          "lv-ground":"arrow-lv-ground",
          control:"arrow-control",
          traction:"arrow-traction",
          "traction-return":"arrow-traction-return"
        }[flow.kind];
        path.setAttribute(flow.direction==="reverse" ? "marker-start" : "marker-end",`url(#${marker})`);
      } else if(fault?.targetConnectionId===connection.id){
        path.setAttribute("marker-end","url(#arrow-fault)");
      }
      svg.append(path);
    }
  }

  function componentFaulted(componentId){
    const fault=currentFault();
    if(!fault) return false;
    const connection=circuit.connections.find((item)=>item.id===fault.targetConnectionId);
    return Boolean(connection && [terminalOwner.get(connection.from),terminalOwner.get(connection.to)].includes(componentId));
  }

  function renderComponents(){
    for(const component of circuit.components){
      const pos=circuit.layout.positions[component.id];
      const group=el("g",{
        class:["component",selectedComponentId===component.id?"selected":"",componentFaulted(component.id)?"faulted":""].filter(Boolean).join(" "),
        tabindex:"0",
        role:"button",
        "aria-label":component.name,
        "data-component-id":component.id
      });
      group.append(el("rect",{x:pos.x-72,y:pos.y-68,width:144,height:144,rx:12,class:"hit-target"}));
      const symbol=symbolLibrary.registry.get(component.symbolId);
      symbolRenderer.renderSymbol(group,symbol,{
        x:pos.x-50,y:pos.y-50,scale:1,className:"component-library-symbol",role:"presentation",ariaLabel:symbol.name
      });
      group.addEventListener("click",()=>inspectComponent(component.id));
      group.addEventListener("keydown",(event)=>{
        if(event.key==="Enter"||event.key===" "){event.preventDefault();inspectComponent(component.id);}
      });
      svg.append(group);
    }
  }

  function renderLabels(){
    for(const component of circuit.components){
      const label=circuit.labels[component.id];
      const pos=circuit.layout.positions[component.id];
      if(!label) continue;
      const cx=label.x+label.width/2;
      const cy=label.y+label.height/2;
      const group=el("g",{
        class:["component-label",selectedComponentId===component.id?"selected":"",componentFaulted(component.id)?"faulted":""].filter(Boolean).join(" "),
        "aria-hidden":"true"
      });
      group.append(el("path",{d:`M ${pos.x} ${pos.y} L ${cx} ${cy}`,class:"label-leader"}));
      group.append(el("rect",{x:label.x,y:label.y,width:label.width,height:label.height,rx:8,class:"label-chip"}));
      group.append(el("text",{x:cx,y:label.y+20,class:"label-title"},label.title));
      group.append(el("text",{x:cx,y:label.y+38,class:"label-subtitle"},label.subtitle));
      svg.append(group);
    }
  }

  function renderTestPoints(){
    const offsets={
      TP_LV_BUS:[24,-24],
      TP_CONTROL_CMD:[30,-18],
      TP_TRACTION_POS:[28,-22],
      TP_TRACTION_RETURN:[28,22],
      TP_DCDC_LV_OUT:[30,18]
    };
    circuit.testPoints.forEach((point,index)=>{
      const p=pointForTerminal(point.terminalId);
      const [dx,dy]=offsets[point.id]||[26,-18];
      const bx=p.x+dx;
      const by=p.y+dy;
      const isTraction=point.trainingSafetyBoundary==="conceptual-only";
      const group=el("g",{
        class:["test-point",isTraction?"traction-test":""].filter(Boolean).join(" "),
        role:"button",
        tabindex:"0",
        "aria-label":`Test point ${index+1}: ${point.id}`,
        "data-test-point-id":point.id
      });
      group.append(el("circle",{cx:p.x,cy:p.y,r:6}));
      group.append(el("line",{x1:p.x,y1:p.y,x2:bx,y2:by,class:"label-leader"}));
      group.append(el("rect",{x:bx-16,y:by-10,width:32,height:20,rx:7,class:"tp-badge"}));
      group.append(el("text",{x:bx,y:by+1,class:"tp-label"},`TP${index+1}`));
      group.addEventListener("click",()=>inspectTestPoint(point,index));
      svg.append(group);
    });
  }

  function render(){
    svg.querySelectorAll("*:not(title):not(desc)").forEach((node)=>node.remove());
    renderDomainZones();
    addDefs();
    renderWires();
    renderComponents();
    renderLabels();
    renderTestPoints();
    renderEngineering();
    stateBadge.textContent=currentState().label;
    flowNote.textContent=currentState().note+" Animated arrows are conceptual and do not represent measured current, switching frequency, torque, or service limits.";
  }

  function inspectComponent(id){
    selectedComponentId=id;
    const component=componentById.get(id);
    const points=engine.getAvailableTestPoints(circuit,id);
    inspector.replaceChildren();

    const heading=document.createElement("h3");
    heading.textContent=component.name;
    const description=document.createElement("p");
    description.textContent=roleText[id]||"Reusable training component.";
    const dl=document.createElement("dl");

    const domainText=component.crossDomain
      ? "Cross-domain training component: TR400 ↔ LV12"
      : component.voltageSystemId;

    for(const [label,value] of [
      ["Library symbol",component.symbolId],
      ["Voltage domain",domainText],
      ["Terminals",component.terminals.map((terminal)=>terminal.name).join(", ")],
      ["Test points",points.length?points.map((point)=>point.id).join(", "):"None"]
    ]){
      const dt=document.createElement("dt");
      const dd=document.createElement("dd");
      dt.textContent=label;
      dd.textContent=value;
      dl.append(dt,dd);
    }
    inspector.append(heading,description,dl);
    render();
  }

  function inspectTestPoint(point,index){
    inspector.replaceChildren();
    const heading=document.createElement("h3");
    heading.textContent=`TP${index+1} — ${point.id}`;
    const description=document.createElement("p");
    description.textContent=point.trainingSafetyBoundary==="conceptual-only"
      ? "Conceptual traction-domain test location for learning only. No probing or service procedure is provided. Vehicle-specific safety procedures and qualified-person requirements apply."
      : `Conceptual measurements: ${point.measurementTypes.join(", ")}. Vehicle-specific values and limits are intentionally omitted.`;
    inspector.append(heading,description);
  }

  stateSelect.addEventListener("change",()=>{operatingState=stateSelect.value;flowMode="system";render();});
  faultSelect.addEventListener("change",()=>{activeFault=faultSelect.value;render();});
  engineeringUi.domainSelect.addEventListener("change",renderEngineering);
  engineeringUi.currentInput.addEventListener("input",renderEngineering);
  engineeringUi.currentInput.addEventListener("change",renderEngineering);
  document.getElementById("showSystemFlow").addEventListener("click",()=>{flowMode="system";render();});
  document.getElementById("traceLv").addEventListener("click",()=>{flowMode="lv";render();});
  document.getElementById("traceControl").addEventListener("click",()=>{flowMode="control";render();});
  document.getElementById("traceDcdc").addEventListener("click",()=>{flowMode="dcdc";render();});
  document.getElementById("traceTraction").addEventListener("click",()=>{flowMode="traction";render();});
  document.getElementById("resetView").addEventListener("click",()=>{
    operatingState="traction-drive-example";
    stateSelect.value=operatingState;
    activeFault="";
    faultSelect.value="";
    selectedComponentId="";
    flowMode="system";
    inspector.innerHTML="<p>Select a component or test point to inspect its role and voltage domain.</p>";
    render();
  });

  render();
})().catch((error)=>{
  console.error(error);
  const target=document.getElementById("inspectorContent");
  if(target) target.textContent="The multi-voltage template could not be loaded.";
});
