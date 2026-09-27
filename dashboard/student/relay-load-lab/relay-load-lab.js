"use strict";

(async function initRelayLoadLab() {
  const NS = "http://www.w3.org/2000/svg";
  const [templateResponse, engineeringResponse, symbolLibrary, connectionLibrary] = await Promise.all([
    fetch("/data/circuit-templates/12v-relay-controlled-load.json"),
    fetch("/data/engineering/labs/relay-load-training.json"),
    window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols"),
    window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections")
  ]);
  if (!templateResponse.ok) throw new Error("Unable to load relay-load template.");
  if (!engineeringResponse.ok) throw new Error("Unable to load relay-load engineering profile.");
  const circuit = await templateResponse.json();
  const engineeringProfile = await engineeringResponse.json();
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
  const engineering = window.TorqueMindEngineering;
  const calculator = engineering.calculator;
  const profileValidator = engineering.profiles.validateEngineeringProfile;
  const voltageArchitecture = voltageDomains.describeVoltageArchitecture(circuit);
  const voltageDomainById = new Map(voltageArchitecture.map((d) => [d.id, d]));

  const engineeringErrors = [
    ...profileValidator(engineeringProfile.loadProfile.engineeringProfile),
    ...engineeringProfile.conductorProfiles.flatMap((entry) => profileValidator(entry.engineeringProfile))
  ];
  if (engineeringErrors.length) throw new Error(engineeringErrors.join("; "));

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
    if (state.id === "command-on") option.selected = true;
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
    BAT1:"12 V nominal source feeding two separately protected branches.",
    FUSE_CTRL:"Protection for the relay control branch.",
    SW1:"Command device controlling relay-coil energization.",
    RELAY_COIL:"Electromagnetic control side of the relay.",
    FUSE_LOAD:"Protection for the switched load branch.",
    RELAY_CONTACT:"Normally open switching contact on the load side.",
    LOAD1:"Generic electrical load supplied through the relay contact.",
    GND1:"Common chassis return reference for this training circuit."
  };

  const engineeringUi = {
    status: document.getElementById("engineeringStatus"),
    sourceVoltage: document.getElementById("engSourceVoltage"),
    loadResistance: document.getElementById("engLoadResistance"),
    pathResistance: document.getElementById("engPathResistance"),
    pathResistanceLabel: document.getElementById("engPathResistanceLabel"),
    current: document.getElementById("engCurrent"),
    voltageDrop: document.getElementById("engVoltageDrop"),
    loadVoltage: document.getElementById("engLoadVoltage"),
    loadPower: document.getElementById("engLoadPower"),
    conductorLoss: document.getElementById("engConductorLoss"),
    formula: document.getElementById("engineeringFormula")
  };

  const loadResistance = engineeringProfile.loadProfile.engineeringProfile.parameters.resistance.value;
  const sourceVoltage = circuit.voltageSystems.find((system) => system.id === "LV12").nominalVoltage;
  const conductorResistanceByConnection = new Map(
    engineeringProfile.conductorProfiles.map((entry) => {
      const parameters = entry.engineeringProfile.parameters;
      const resistance = calculator.calculateConductorResistance({
        resistivityOhmMeter: parameters.resistivity.value,
        length: parameters.length.value,
        lengthUnit: parameters.length.unit,
        area: parameters.area.value,
        areaUnit: parameters.area.unit
      });
      return [entry.targetConnectionId, resistance.value];
    })
  );
  const basePathResistance = [...conductorResistanceByConnection.values()].reduce((sum, value) => sum + value, 0);

  function formatEngineering(value, unit, digits=3) {
    return `${Number(value.toFixed(digits))} ${unit}`;
  }

  function engineeringFaultResistance() {
    const entry = engineeringProfile.faultEngineering.find((item) => item.faultId === activeFault);
    return entry ? entry.addedResistance.value : 0;
  }

  function loadCircuitIsClosed() {
    if (operatingState !== "command-on") return false;
    const fault = faultObj();
    if (!fault) return true;
    return fault.type !== "open_circuit";
  }

  function calculateEngineeringState() {
    const addedFaultResistance = engineeringFaultResistance();
    const pathResistance = basePathResistance + addedFaultResistance;
    const closed = loadCircuitIsClosed();

    if (!closed) {
      return {
        active:false,
        addedFaultResistance,
        pathResistance,
        current:0,
        loadPower:0
      };
    }

    const totalResistance = loadResistance + pathResistance;
    const current = calculator.solveOhmsLaw({
      voltage:sourceVoltage,
      resistance:totalResistance
    });
    const voltageDrop = calculator.calculateVoltageDrop({
      current:current.value,
      resistance:pathResistance
    });
    const loadVoltage = calculator.calculateLoadVoltage({
      sourceVoltage,
      voltageDrop:voltageDrop.value
    });
    const loadPower = calculator.calculatePower({
      voltage:loadVoltage.value,
      current:current.value
    });
    const conductorLoss = calculator.calculatePowerLoss({
      current:current.value,
      resistance:pathResistance
    });

    return {
      active:true,
      addedFaultResistance,
      pathResistance,
      current,
      voltageDrop,
      loadVoltage,
      loadPower,
      conductorLoss
    };
  }

  function renderEngineering() {
    const values = calculateEngineeringState();
    engineeringUi.sourceVoltage.textContent = formatEngineering(sourceVoltage,"V",1);
    engineeringUi.loadResistance.textContent = formatEngineering(loadResistance,"Ω",2);
    engineeringUi.pathResistance.textContent = formatEngineering(values.pathResistance,"Ω",4);

    if (values.addedFaultResistance > 0) {
      engineeringUi.status.textContent = "High-resistance training fault active";
      engineeringUi.status.className = "engineering-status degraded";
      engineeringUi.pathResistanceLabel.textContent = `Conductor path + ${formatEngineering(values.addedFaultResistance,"Ω",2)} fault resistance`;
    } else if (!values.active) {
      engineeringUi.status.textContent = "Load circuit inactive / interrupted";
      engineeringUi.status.className = "engineering-status inactive";
      engineeringUi.pathResistanceLabel.textContent = "Calculated conductor resistance";
    } else {
      engineeringUi.status.textContent = "Healthy training example";
      engineeringUi.status.className = "engineering-status";
      engineeringUi.pathResistanceLabel.textContent = "Calculated conductor resistance";
    }

    if (!values.active) {
      engineeringUi.current.textContent = "0 A";
      engineeringUi.voltageDrop.textContent = "—";
      engineeringUi.loadVoltage.textContent = "—";
      engineeringUi.loadPower.textContent = "0 W";
      engineeringUi.conductorLoss.textContent = "—";
      engineeringUi.formula.textContent = "The load-current path is not closed in this state. Current and load power are shown as zero; open-circuit voltage distribution is intentionally not inferred.";
      return;
    }

    engineeringUi.current.textContent = formatEngineering(values.current.value,"A",3);
    engineeringUi.voltageDrop.textContent = formatEngineering(values.voltageDrop.value,"V",3);
    engineeringUi.loadVoltage.textContent = formatEngineering(values.loadVoltage.value,"V",3);
    engineeringUi.loadPower.textContent = formatEngineering(values.loadPower.value,"W",3);
    engineeringUi.conductorLoss.textContent = formatEngineering(values.conductorLoss.value,"W",3);
    engineeringUi.formula.textContent = `Series model: I = V ÷ (Rload + Rpath). Calculated values carry provenance from the declared ${formatEngineering(sourceVoltage,"V",1)} system value and the generic training-example resistance inputs.`;
  }

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
    if (["W_COIL_GND","W_LOAD_GND","W_BAT_GND"].includes(connection.id)) {
      const railY = connection.id === "W_COIL_GND" ? 500 : 560;
      return `M ${a.x} ${a.y} V ${railY} H ${b.x} V ${b.y}`;
    }
    if (connection.id === "W_BAT_LOAD_FUSE") return `M ${a.x} ${a.y} V 330 H ${b.x}`;
    const midX = Math.round((a.x+b.x)/2);
    return `M ${a.x} ${a.y} H ${midX} V ${b.y} H ${b.x}`;
  }
  function addDefs() {
    const defs = el("defs");
    for (const [id,color] of [["arrow-power","#c62828"],["arrow-ground","#20252d"],["arrow-control","#1565c0"],["arrow-fault","#ef6c00"]]) {
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
      control: flowMode === "control" ? flows.control : []
    };
  }
  function flowMap() {
    const map = new Map();
    const flows = selectedFlows();
    for (const [id,direction] of flows.power) map.set(id,{kind:"power",direction});
    for (const [id,direction] of flows.ground) map.set(id,{kind:"ground",direction});
    for (const [id,direction] of flows.control) map.set(id,{kind:"control",direction});
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
      const path = el("path",{
        d:routePath(connection),
        class:[
          "wire",`wire-role-${style.strokeRole}`,`voltage-domain-${domain.domainClass}`,
          connection.type.replaceAll("_","-"),
          flow && flowAllowed(connection.id) ? `flow-${flow.kind}` : "",
          flow?.direction === "reverse" ? "reverse" : "",
          fault?.targetConnectionId === connection.id && fault.type === "open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId === connection.id && fault.type === "high_resistance" ? "fault-degraded" : ""
        ].filter(Boolean).join(" "),
        style:`--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern||"none"}`,
        "data-connection-id":connection.id,
        "data-style-id":connection.styleId,
        "data-voltage-system-id":connection.voltageSystemId
      });
      if (flow && flowAllowed(connection.id)) {
        const marker = flow.kind === "power" ? "arrow-power" : flow.kind === "ground" ? "arrow-ground" : "arrow-control";
        path.setAttribute(flow.direction === "reverse" ? "marker-start" : "marker-end", `url(#${marker})`);
      } else if (fault?.targetConnectionId === connection.id) {
        path.setAttribute("marker-end","url(#arrow-fault)");
      }
      svg.append(path);
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
      group.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();inspect(component.id);}});
      svg.append(group);
    }
  }
  function renderLabels() {
    for (const component of circuit.components) {
      const label = circuit.labels[component.id];
      const pos = circuit.layout.positions[component.id];
      if (!label) continue;
      const cx = label.x + label.width/2;
      const cy = label.y + label.height/2;
      const group = el("g",{class:["component-label",selectedComponentId===component.id?"selected":"",componentFaulted(component.id)?"faulted":""].filter(Boolean).join(" "),"data-label-for":component.id,"aria-hidden":"true"});
      group.append(el("path",{d:`M ${pos.x} ${pos.y} L ${cx} ${cy}`,class:"label-leader"}));
      group.append(el("rect",{x:label.x,y:label.y,width:label.width,height:label.height,rx:8,class:"label-chip"}));
      group.append(el("text",{x:cx,y:label.y+20,class:"label-title"},label.title));
      group.append(el("text",{x:cx,y:label.y+38,class:"label-subtitle"},label.subtitle));
      svg.append(group);
    }
  }
  function renderTestPoints() {
    circuit.testPoints.forEach((point,index) => {
      const p = pointForTerminal(point.terminalId);
      const dx = index % 2 === 0 ? 28 : -28;
      const dy = index % 2 === 0 ? -22 : 22;
      const bx = p.x + dx, by = p.y + dy;
      const group = el("g",{class:"test-point",role:"button",tabindex:"0","aria-label":`Test point ${index+1}: ${point.id}`,"data-test-point-id":point.id});
      group.append(el("circle",{cx:p.x,cy:p.y,r:6}));
      group.append(el("line",{x1:p.x,y1:p.y,x2:bx,y2:by,class:"label-leader"}));
      group.append(el("rect",{x:bx-18,y:by-11,width:36,height:22,rx:7,class:"tp-badge"}));
      group.append(el("text",{x:bx,y:by+1,class:"tp-label"},`TP${index+1}`));
      group.addEventListener("click",()=>inspectTestPoint(point));
      svg.append(group);
    });
  }
  function render() {
    svg.querySelectorAll("*:not(title):not(desc)").forEach((n)=>n.remove());
    addDefs(); renderWires(); renderComponents(); renderLabels(); renderTestPoints(); renderEngineering();
    stateBadge.textContent = stateDef().label;
    flowNote.textContent = stateDef().note + " Animated arrows are conceptual and do not represent measured magnitude.";
  }
  function inspect(id) {
    selectedComponentId = id;
    const component = componentById.get(id);
    const connected = engine.getConnectedComponents(circuit,id,{faults:activeFault?[activeFault]:[]});
    const points = engine.getAvailableTestPoints(circuit,id);
    inspector.replaceChildren();
    const h = document.createElement("h3"); h.textContent = component.name;
    const p = document.createElement("p"); p.textContent = roleText[id] || "Reusable training component.";
    const dl = document.createElement("dl");
    for (const [label,value] of [
      ["Library symbol",component.symbolId],["Voltage domain",component.voltageSystemId],
      ["Terminals",component.terminals.map((t)=>t.name).join(", ")],
      ["Connected to",connected.length?connected.map((x)=>componentById.get(x)?.name||x).join(", "):"No connection under current fault state"],
      ["Test points",points.length?points.map((x)=>x.id).join(", "):"None"]
    ]) {
      const dt=document.createElement("dt");dt.textContent=label;
      const dd=document.createElement("dd");dd.textContent=value;dl.append(dt,dd);
    }
    inspector.append(h,p,dl); render();
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
  document.getElementById("traceControl").addEventListener("click",()=>{flowMode="control";render();});
  document.getElementById("tracePower").addEventListener("click",()=>{flowMode="power";render();});
  document.getElementById("traceGround").addEventListener("click",()=>{flowMode="ground";render();});
  document.getElementById("resetView").addEventListener("click",()=>{
    operatingState="command-on";stateSelect.value="command-on";activeFault="";faultSelect.value="";selectedComponentId="";flowMode="system";
    inspector.innerHTML="<p>Select a symbol or test point to inspect its role.</p>";render();
  });
  render();
})().catch((error)=>{
  console.error(error);
  const target=document.getElementById("inspectorContent");
  if(target)target.textContent="The relay-load template could not be loaded.";
});
