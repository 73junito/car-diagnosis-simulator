"use strict";

(async function initSensorLab() {
  const NS = "http://www.w3.org/2000/svg";
  const [templateResponse, symbolLibrary, connectionLibrary] = await Promise.all([
    fetch("/data/circuit-templates/12v-three-wire-sensor.json"),
    window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols"),
    window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections")
  ]);
  if (!templateResponse.ok) throw new Error("Unable to load sensor template.");
  const circuit = await templateResponse.json();
  const engine = window.TorqueMindCircuitEngine;
  const validation = window.TorqueMindCircuitTemplateContracts.validateCircuitTemplate(
    circuit, engine, symbolLibrary.registry, connectionLibrary.registry
  );
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const svg = document.getElementById("circuitSvg");
  const inspector = document.getElementById("inspectorContent");
  const faultSelect = document.getElementById("faultSelect");
  const stateSelect = document.getElementById("stateSelect");
  const stateBadge = document.getElementById("stateBadge");
  const voltageProfile = document.getElementById("voltageProfile");
  const flowNote = document.getElementById("flowNote");
  const voltageDomains = window.TorqueMindVoltageDomains;
  const symbolRenderer = window.TorqueMindSymbolRenderer;

  const voltageArchitecture = voltageDomains.describeVoltageArchitecture(circuit);
  const voltageDomainById = new Map(voltageArchitecture.map((d) => [d.id, d]));
  for (const domain of voltageArchitecture) {
    const chip = document.createElement("span");
    chip.className = `voltage-chip voltage-domain-${domain.domainClass}`;
    chip.dataset.voltageSystemId = domain.id;
    const small = document.createElement("small");
    small.textContent = domain.powertrainLabel;
    const value = document.createElement("span");
    value.textContent = domain.label;
    chip.append(small, value);
    voltageProfile.append(chip);
  }

  for (const state of circuit.operatingStates) {
    const option = document.createElement("option");
    option.value = state.id;
    option.textContent = state.label;
    if (state.id === "active-signal") option.selected = true;
    stateSelect.append(option);
  }
  for (const fault of circuit.faultCatalog) {
    const option = document.createElement("option");
    option.value = fault.id;
    option.textContent = fault.label;
    faultSelect.append(option);
  }

  const componentById = new Map(circuit.components.map((c) => [c.id, c]));
  const terminalOwner = new Map();
  for (const c of circuit.components) for (const t of c.terminals) terminalOwner.set(t.id, c.id);

  let operatingState = stateSelect.value;
  let activeFault = "";
  let selectedComponentId = "";
  let flowMode = "system";

  const roleText = {
    BAT1:"12 V nominal vehicle-system source.",
    FUSE1:"Generic protection for controller/reference-supply power.",
    ECM1:"Controller receiving the sensor signal and powered from the 12 V system.",
    REF1:"Training reference supply converting the vehicle-system input to a 5 V nominal example reference.",
    SENSOR1:"Generic three-wire powered sensor with supply, signal, and ground/reference.",
    GND1:"Common return/reference point in this generic training circuit."
  };

  function el(name, attrs={}, text="") {
    const node = document.createElementNS(NS, name);
    for (const [k,v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text) node.textContent = text;
    return node;
  }
  function stateDef() { return circuit.operatingStates.find((s) => s.id === operatingState); }
  function faultObj() { return activeFault ? engine.getFault(circuit, activeFault) : null; }
  function pointForTerminal(terminalId) {
    const ownerId = terminalOwner.get(terminalId);
    const component = componentById.get(ownerId);
    const pos = circuit.layout.positions[ownerId];
    const terminal = component.terminals.find((t) => t.id === terminalId);
    const symbol = symbolLibrary.registry.get(component.symbolId);
    const symbolTerminal = symbol.terminals.find((t) => t.id === terminal.symbolTerminalId);
    if (!symbolTerminal) throw new Error(`Missing symbol-terminal mapping for ${terminalId}`);
    return { x:pos.x-50+symbolTerminal.x, y:pos.y-50+symbolTerminal.y };
  }
  function routePath(connection) {
    const a = pointForTerminal(connection.from);
    const b = pointForTerminal(connection.to);
    if (["W_ECM_GND","W_SENSOR_GND","W_BAT_GND"].includes(connection.id)) {
      const railY = connection.id === "W_SENSOR_GND" ? 520 : 565;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }
    if (connection.id === "W_FUSE_REF") return `M ${a.x} ${a.y} V 115 H ${b.x}`;
    if (connection.id === "W_SENSOR_SIGNAL") return `M ${a.x} ${a.y} H 600 V ${b.y} H ${b.x}`;
    const midX = Math.round((a.x+b.x)/2);
    return `M ${a.x} ${a.y} H ${midX} V ${b.y} H ${b.x}`;
  }
  function addDefs() {
    const defs = el("defs");
    for (const [id,color] of [["arrow-power","#c62828"],["arrow-ground","#20252d"],["arrow-signal","#52667a"],["arrow-fault","#ef6c00"]]) {
      const marker = el("marker",{id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"});
      marker.append(el("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:color}));
      defs.append(marker);
    }
    svg.append(defs);
  }
  function selectedFlows() {
    const flows = stateDef().activeFlows;
    if (flowMode === "system") return flows;
    return {
      power: flowMode === "power" ? flows.power : [],
      ground: flowMode === "ground" ? flows.ground : [],
      control: [],
      signal: flowMode === "signal" ? flows.signal : []
    };
  }
  function flowMap() {
    const map = new Map();
    const flows = selectedFlows();
    for (const [id,direction] of flows.power || []) map.set(id,{kind:"power",direction});
    for (const [id,direction] of flows.ground || []) map.set(id,{kind:"ground",direction});
    for (const [id,direction] of flows.signal || []) map.set(id,{kind:"signal",direction});
    return map;
  }
  function flowAllowed(id) {
    const fault = faultObj();
    return !(fault && fault.type === "open_circuit" && fault.targetConnectionId === id);
  }
  function renderWires() {
    const current = flowMap();
    const fault = faultObj();
    for (const connection of circuit.connections) {
      const flow = current.get(connection.id);
      const style = connectionLibrary.registry.get(connection.styleId);
      const domain = voltageDomainById.get(connection.voltageSystemId);
      const isShort = fault?.targetConnectionId === connection.id && (fault.type === "short_to_ground" || fault.type === "short_to_power");
      const path = el("path",{
        d:routePath(connection),
        class:[
          "wire",`wire-role-${style.strokeRole}`,`voltage-domain-${domain.domainClass}`,
          connection.type.replaceAll("_","-"),
          flow && flowAllowed(connection.id) ? `flow-${flow.kind}` : "",
          flow?.direction === "reverse" ? "reverse" : "",
          fault?.targetConnectionId === connection.id && fault.type === "open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId === connection.id && fault.type === "high_resistance" ? "fault-degraded" : "",
          isShort ? "fault-short" : ""
        ].filter(Boolean).join(" "),
        style:`--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern||"none"}`,
        "data-connection-id":connection.id,
        "data-style-id":connection.styleId,
        "data-voltage-system-id":connection.voltageSystemId
      });
      if (flow && flowAllowed(connection.id)) {
        const marker = flow.kind === "power" ? "arrow-power" : flow.kind === "ground" ? "arrow-ground" : "arrow-signal";
        path.setAttribute(flow.direction === "reverse" ? "marker-start" : "marker-end", `url(#${marker})`);
      } else if (fault?.targetConnectionId === connection.id) {
        path.setAttribute("marker-end","url(#arrow-fault)");
      }
      svg.append(path);
    }

    if (fault && (fault.type === "short_to_ground" || fault.type === "short_to_power")) {
      const a = pointForTerminal(fault.targetTerminalId);
      const b = pointForTerminal(fault.shortTargetTerminalId);
      svg.append(el("path",{
        d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,
        class:"wire fault-short",
        "data-fault-short-id":fault.id
      }));
    }
  }
  function activeComponents() {
    const ids = new Set(["BAT1"]);
    const current = flowMap();
    for (const connection of circuit.connections) {
      if (!current.has(connection.id) || !flowAllowed(connection.id)) continue;
      ids.add(terminalOwner.get(connection.from));
      ids.add(terminalOwner.get(connection.to));
    }
    return ids;
  }
  function componentFaulted(id) {
    const fault = faultObj();
    if (!fault) return false;
    const c = circuit.connections.find((x) => x.id === fault.targetConnectionId);
    return c && [terminalOwner.get(c.from),terminalOwner.get(c.to)].includes(id);
  }
  function renderComponents() {
    const active = activeComponents();
    for (const component of circuit.components) {
      const pos = circuit.layout.positions[component.id];
      const group = el("g",{
        class:["component",selectedComponentId===component.id?"selected":"",active.has(component.id)?"energized":"",componentFaulted(component.id)?"faulted":""].filter(Boolean).join(" "),
        tabindex:"0",role:"button","aria-label":component.name,"data-component-id":component.id
      });
      group.append(el("rect",{x:pos.x-72,y:pos.y-68,width:144,height:144,rx:12,class:"hit-target"}));
      const symbol = symbolLibrary.registry.get(component.symbolId);
      symbolRenderer.renderSymbol(group,symbol,{x:pos.x-50,y:pos.y-50,scale:1,className:"component-library-symbol",role:"presentation",ariaLabel:symbol.name});
      group.addEventListener("click",()=>inspect(component.id));
      svg.append(group);
    }
  }
  function renderLabels() {
    for (const component of circuit.components) {
      const label = circuit.labels[component.id];
      const pos = circuit.layout.positions[component.id];
      if (!label) continue;
      const cx=label.x+label.width/2, cy=label.y+label.height/2;
      const group=el("g",{class:["component-label",componentFaulted(component.id)?"faulted":""].filter(Boolean).join(" "),"aria-hidden":"true"});
      group.append(el("path",{d:`M ${pos.x} ${pos.y} L ${cx} ${cy}`,class:"label-leader"}));
      group.append(el("rect",{x:label.x,y:label.y,width:label.width,height:label.height,rx:8,class:"label-chip"}));
      group.append(el("text",{x:cx,y:label.y+20,class:"label-title"},label.title));
      group.append(el("text",{x:cx,y:label.y+38,class:"label-subtitle"},label.subtitle));
      svg.append(group);
    }
  }
  function renderTestPoints() {
    for (const point of circuit.testPoints) {
      const p = pointForTerminal(point.terminalId);
      const group=el("g",{class:"test-point",role:"button",tabindex:"0","aria-label":`Test point ${point.id}`,"data-test-point-id":point.id});
      group.append(el("circle",{cx:p.x,cy:p.y,r:8}));
      group.append(el("text",{x:p.x+11,y:p.y-10},"TP"));
      group.addEventListener("click",()=>inspectTestPoint(point));
      svg.append(group);
    }
  }
  function render() {
    svg.querySelectorAll("*:not(title):not(desc)").forEach((n)=>n.remove());
    addDefs(); renderWires(); renderComponents(); renderLabels(); renderTestPoints();
    stateBadge.textContent = stateDef().label;
    flowNote.textContent = stateDef().note + " Animated arrows are conceptual and do not represent measured magnitude.";
  }
  function inspect(id) {
    selectedComponentId=id;
    const component=componentById.get(id);
    const points=engine.getAvailableTestPoints(circuit,id);
    inspector.replaceChildren();
    const h=document.createElement("h3"); h.textContent=component.name;
    const p=document.createElement("p"); p.textContent=roleText[id]||"Reusable training component.";
    const dl=document.createElement("dl");
    for(const [label,value] of [["Library symbol",component.symbolId],["Voltage domain",component.voltageSystemId],["Terminals",component.terminals.map((t)=>t.name).join(", ")],["Test points",points.length?points.map((x)=>x.id).join(", "):"None"]]){
      const dt=document.createElement("dt");dt.textContent=label;const dd=document.createElement("dd");dd.textContent=value;dl.append(dt,dd);
    }
    inspector.append(h,p,dl);render();
  }
  function inspectTestPoint(point) {
    inspector.replaceChildren();
    const h=document.createElement("h3");h.textContent=point.id;
    const p=document.createElement("p");p.textContent=`Available conceptual measurements: ${point.measurementTypes.join(", ")}. Vehicle-specific values and limits are intentionally omitted.`;
    inspector.append(h,p);
  }

  stateSelect.addEventListener("change",()=>{operatingState=stateSelect.value;flowMode="system";render();});
  faultSelect.addEventListener("change",()=>{activeFault=faultSelect.value;render();});
  document.getElementById("showSystemFlow").addEventListener("click",()=>{flowMode="system";render();});
  document.getElementById("tracePower").addEventListener("click",()=>{flowMode="power";render();});
  document.getElementById("traceSignal").addEventListener("click",()=>{flowMode="signal";render();});
  document.getElementById("traceGround").addEventListener("click",()=>{flowMode="ground";render();});
  document.getElementById("resetView").addEventListener("click",()=>{
    operatingState="active-signal";stateSelect.value="active-signal";activeFault="";faultSelect.value="";selectedComponentId="";flowMode="system";
    inspector.innerHTML="<p>Select a symbol or test point to inspect its role.</p>";render();
  });
  render();
})().catch((error)=>{
  console.error(error);
  const target=document.getElementById("inspectorContent");
  if(target)target.textContent="The sensor template could not be loaded.";
});
