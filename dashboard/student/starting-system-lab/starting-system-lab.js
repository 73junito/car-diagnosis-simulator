"use strict";

(async function initStartingSystemLab() {
  const NS = "http://www.w3.org/2000/svg";
  const [templateResponse, interstateResponse, delcoResponse, symbolLibrary, connectionLibrary] = await Promise.all([
    fetch("/data/circuit-templates/12v-starting-system.json"),
    fetch("/data/engineering/authoritative-specifications/interstate-batteries-2021.json"),
    fetch("/data/engineering/authoritative-specifications/delco-remy-starting-charging.json"),
    window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols"),
    window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections")
  ]);
  if (!templateResponse.ok) throw new Error("Unable to load starting-system template.");
  if (!interstateResponse.ok || !delcoResponse.ok) throw new Error("Unable to load starting-system engineering references.");
  const circuit = await templateResponse.json();
  const interstateCatalog = await interstateResponse.json();
  const delcoCatalog = await delcoResponse.json();
  const engine = window.TorqueMindCircuitEngine;
  const templateValidation = window.TorqueMindCircuitTemplateContracts.validateCircuitTemplate(
    circuit, engine, symbolLibrary.registry, connectionLibrary.registry
  );
  if (!templateValidation.valid) throw new Error(templateValidation.errors.join("; "));

  const svg = document.getElementById("circuitSvg");
  const inspector = document.getElementById("inspectorContent");
  const faultSelect = document.getElementById("faultSelect");
  const stateSelect = document.getElementById("stateSelect");
  const stateBadge = document.getElementById("stateBadge");
  const voltageProfile = document.getElementById("voltageProfile");
  const flowNote = document.getElementById("flowNote");
  const guidedSteps = [...document.querySelectorAll("#guidedSteps li")];
  const voltageDomains = window.TorqueMindVoltageDomains;
  const symbolRenderer = window.TorqueMindSymbolRenderer;
  const engineering = window.TorqueMindEngineering;
  const specifications = engineering.specifications;
  const calculator = engineering.calculator;
  const measurements = engineering.measurements;
  const comparisons = engineering.comparisons;
  const artifacts = engineering.artifacts;
  const artifactRegistry = await artifacts.loadRegistry();
  const startingArtifactByScenario = new Map([
    ["within", await artifacts.resolveArtifact(
      artifactRegistry,
      "starting.cable-drop.within-candidate",
      {systemVoltage:12,testCurrentA:500,scenarioId:"within"}
    )],
    ["exceeds", await artifacts.resolveArtifact(
      artifactRegistry,
      "starting.cable-drop.exceeds-candidate",
      {systemVoltage:12,testCurrentA:500,scenarioId:"exceeds"}
    )],
    ["open", await artifacts.resolveArtifact(
      artifactRegistry,
      "starting.cable-drop.open-unavailable",
      {systemVoltage:12,scenarioId:"open"}
    )]
  ]);

  const voltageArchitecture = voltageDomains.describeVoltageArchitecture(circuit);
  const voltageDomainById = new Map(voltageArchitecture.map((domain) => [domain.id, domain]));
  for (const domain of voltageArchitecture) {
    const chip = document.createElement("span");
    chip.className = `voltage-chip voltage-domain-${domain.domainClass}`;
    chip.dataset.voltageSystemId = domain.id;
    const kind = document.createElement("small");
    kind.textContent = domain.powertrainLabel;
    const value = document.createElement("span");
    value.textContent = domain.label;
    chip.append(kind, value);
    voltageProfile.append(chip);
  }

  for (const state of circuit.operatingStates) {
    const option = document.createElement("option");
    option.value = state.id;
    option.textContent = state.label;
    if (state.id === "crank") option.selected = true;
    stateSelect.append(option);
  }
  for (const fault of circuit.faultCatalog) {
    const option = document.createElement("option");
    option.value = fault.id;
    option.textContent = fault.label;
    faultSelect.append(option);
  }

  const componentById = new Map(circuit.components.map((component) => [component.id, component]));
  const terminalOwner = new Map();
  for (const component of circuit.components) {
    for (const terminal of component.terminals) terminalOwner.set(terminal.id, component.id);
  }

  let operatingState = stateSelect.value;
  let activeFault = "";
  let selectedComponentId = "";
  let activeFlowMode = "system";
  let guideProgress = 0;

  const roleText = Object.freeze({
    BAT1: "The 12 V nominal electrical source for this generic starting-system template.",
    FUSE1: "Generic protection for the start-command/control branch. Actual vehicle protection strategy is vehicle-specific.",
    SW1: "A normally open start-command switch representing the driver's or control system's crank request.",
    SOL_COIL: "The electromagnetic actuator portion of the starter-solenoid representation.",
    SOL_CONTACT: "The normally open high-current switching contact associated with the starter-solenoid representation.",
    MTR1: "The starter motor, represented as the high-current cranking load.",
    GND1: "The engine/chassis return reference for the generic training circuit."
  });

  const engineeringUi = {
    status:document.getElementById("startingEngineeringStatus"),
    batterySelect:document.getElementById("batteryReferenceSelect"),
    starterSelect:document.getElementById("starterFamilySelect"),
    modelScenario:document.getElementById("startingModelScenario"),
    modelScenarioResult:document.getElementById("startingModelScenarioResult"),
    cca:document.getElementById("engBatteryCca"),
    ca:document.getElementById("engBatteryCa"),
    rc:document.getElementById("engBatteryRc"),
    ah:document.getElementById("engBatteryAh"),
    testCurrent:document.getElementById("engStarterTestCurrent"),
    dropLimit:document.getElementById("engStarterDropLimit"),
    resistance:document.getElementById("engCableResistanceLimit"),
    measuredDrop:document.getElementById("measuredStarterDrop"),
    measuredResult:document.getElementById("startingMeasurementResult"),
    comparison:document.getElementById("startingComparisonSummary"),
    formula:document.getElementById("startingEngineeringFormula")
  };

  for (const profile of interstateCatalog.productProfiles) {
    const option=document.createElement("option");
    option.value=profile.partNumber;
    option.textContent=`${profile.partNumber} — ${profile.groupSize}`;
    if (profile.partNumber==="31P-HD") option.selected=true;
    engineeringUi.batterySelect.append(option);
  }

  function renderEngineering() {
    const battery=specifications.findProductProfile(interstateCatalog,{partNumber:engineeringUi.batterySelect.value,systemVoltage:12});
    const family=engineeringUi.starterSelect.value;
    const testCurrent=specifications.selectMostSpecificSpecification(delcoCatalog,{system:"starting",systemVoltage:12,parameter:"starter_cable_test_current"});
    const dropLimit=specifications.selectMostSpecificSpecification(delcoCatalog,{system:"starting",systemVoltage:12,starterFamily:family,parameter:"starter_cable_total_voltage_drop"});
    const referenceApplicability=dropLimit
      ? specifications.evaluateSpecificationApplicability(dropLimit,{
          system:"starting",
          systemVoltage:12,
          starterFamily:family,
          testMethod:"carbon-pile battery-cable voltage-drop test"
        })
      : {applicable:false,reason:"No applicable authoritative reference is selected."};
    const p=battery?.engineeringProfile?.parameters || {};
    const resistance=(testCurrent && dropLimit)
      ? calculator.solveOhmsLaw({voltage:dropLimit.quantity.value,current:testCurrent.quantity.value})
      : null;

    engineeringUi.cca.textContent=p.coldCrankingCurrent ? `${p.coldCrankingCurrent.value} A` : "—";
    engineeringUi.ca.textContent=p.crankingCurrent32F ? `${p.crankingCurrent32F.value} A` : "—";
    engineeringUi.rc.textContent=p.reserveCapacity ? `${p.reserveCapacity.value} min` : "—";
    engineeringUi.ah.textContent=p.capacity20Hr ? `${p.capacity20Hr.value} Ah` : "—";
    engineeringUi.testCurrent.textContent=testCurrent ? `${testCurrent.quantity.value} A` : "—";
    engineeringUi.dropLimit.textContent=dropLimit ? `${dropLimit.quantity.value.toFixed(3)} V max` : "—";
    engineeringUi.resistance.textContent=resistance ? `${(resistance.value*1000).toFixed(3)} mΩ` : "—";

    const fault=faultObject();
    const scenarioId=engineeringUi.modelScenario.value;
    const scenarioResult=startingArtifactByScenario.get(scenarioId) || null;
    let scenarioComparison=null;
    engineeringUi.modelScenarioResult.className="measurement-result";
    if(!scenarioId){
      engineeringUi.modelScenarioResult.textContent="No modeled scenario selected";
    } else if(scenarioResult?.status!=="ready"){
      engineeringUi.modelScenarioResult.textContent="Selected modeled scenario is unavailable";
    } else {
      const artifact=scenarioResult.artifact;
      if(scenarioId!=="open" && testCurrent?.quantity.value!==500){
        throw new Error("Starting artifact requires the selected 500 A source-backed test current.");
      }
      scenarioComparison=dropLimit
        ? artifacts.compareObservedToAuthoritativeReference(artifact,dropLimit,{
            applicable:referenceApplicability.applicable,
            reason:referenceApplicability.reason,
            openCircuit:scenarioId==="open" || fault?.type==="open_circuit",
            nominalVoltage:12
          })
        : null;
      engineeringUi.modelScenarioResult.textContent=artifact.observed
        ? `Training-model scenario: ${artifact.observed.value.toFixed(3)} V from ${artifact.artifactId}. This is not a measurement.`
        : `Training-model scenario: numeric cable drop unavailable from ${artifact.artifactId}. This is not a measurement.`;
    }

    const measuredRaw=engineeringUi.measuredDrop.value.trim();
    engineeringUi.measuredResult.className="measurement-result";
    engineeringUi.comparison.className="engineering-comparison";

    if(measuredRaw){
      const measuredValue=Number(measuredRaw);
      if(Number.isFinite(measuredValue) && measuredValue>=0){
        const measured=measurements.createMeasuredQuantity({
          quantityType:"voltage_drop",unit:"V",value:measuredValue,
          labId:"starting-system-lab",measurementId:"starter-total-cable-drop",
          voltageSystemId:"LV12",nominalVoltage:12
        });
        if(dropLimit){
          const comparison=comparisons.compareMeasuredToReference(measured,dropLimit,{
            applicable:referenceApplicability.applicable,
            openCircuit:fault?.type==="open_circuit",
            reason:fault?.type==="open_circuit"
              ? "Selected source comparison is not applied to an open circuit."
              : referenceApplicability.reason
          });
          if(comparison.status==="within_reference"){
            engineeringUi.measuredResult.textContent=`Recorded ${measured.value.toFixed(3)} V — within selected ${family} source reference`;
            engineeringUi.measuredResult.className="measurement-result within";
            engineeringUi.comparison.textContent=`Authoritative measurement comparison: ${measured.value.toFixed(3)} V is within the selected ${dropLimit.quantity.value.toFixed(3)} V maximum for ${family}.`;
            engineeringUi.comparison.classList.add("within");
          } else if(comparison.status==="exceeds_reference"){
            engineeringUi.measuredResult.textContent=`Recorded ${measured.value.toFixed(3)} V — exceeds selected ${family} source reference`;
            engineeringUi.measuredResult.className="measurement-result exceeds";
            engineeringUi.comparison.textContent=`Authoritative measurement comparison: ${measured.value.toFixed(3)} V exceeds the selected ${dropLimit.quantity.value.toFixed(3)} V maximum for ${family}.`;
            engineeringUi.comparison.classList.add("exceeds");
          } else {
            engineeringUi.measuredResult.textContent=`Recorded ${measured.value.toFixed(3)} V; source comparison not applicable`;
            engineeringUi.comparison.textContent=comparison.reason || "Source comparison unavailable for the selected condition.";
            engineeringUi.comparison.classList.add("not-comparable");
          }
        }
      } else {
        engineeringUi.measuredResult.textContent="Enter a non-negative finite voltage-drop value";
      }
    } else {
      engineeringUi.measuredResult.textContent="No measurement entered";
      if(scenarioId && scenarioComparison){
        if(scenarioComparison.status==="within_reference"){
          engineeringUi.comparison.textContent=`Training-model scenario comparison: ${scenarioComparison.observedValue.toFixed(3)} V is within the selected ${dropLimit.quantity.value.toFixed(3)} V authoritative maximum for ${family}. Model evidence remains project-authored; the source record supplies the limit.`;
          engineeringUi.comparison.classList.add("within");
        } else if(scenarioComparison.status==="exceeds_reference"){
          engineeringUi.comparison.textContent=`Training-model scenario comparison: ${scenarioComparison.observedValue.toFixed(3)} V exceeds the selected ${dropLimit.quantity.value.toFixed(3)} V authoritative maximum for ${family}. Model evidence remains project-authored; the source record supplies the limit.`;
          engineeringUi.comparison.classList.add("exceeds");
        } else {
          engineeringUi.comparison.textContent=scenarioComparison.reason || "Training-model scenario is not comparable to the selected source reference.";
          engineeringUi.comparison.classList.add("not-comparable");
        }
      } else {
        engineeringUi.comparison.textContent=fault?.type==="open_circuit"
          ? "Open circuit active; source-backed cable-drop comparison is not applicable."
          : "Enter a cable-drop measurement or choose a validated training-model scenario.";
        if(fault?.type==="open_circuit") engineeringUi.comparison.classList.add("not-comparable");
      }
    }

    if (fault?.type==="open_circuit") {
      engineeringUi.status.textContent="Open circuit — numeric cable-drop comparison not inferred";
      engineeringUi.status.className="engineering-status fault";
    } else if (fault?.type==="high_resistance") {
      engineeringUi.status.textContent="High-resistance path — compare measured or modeled drop to the cited procedure";
      engineeringUi.status.className="engineering-status fault";
    } else {
      engineeringUi.status.textContent="Reference values loaded";
      engineeringUi.status.className="engineering-status";
    }

    const batteryText=battery ? `${battery.partNumber}: ${p.coldCrankingCurrent?.value ?? "—"} A CCA` : "No battery selected";
    const starterText=dropLimit && testCurrent
      ? `${family}: ${dropLimit.quantity.value.toFixed(3)} V max total cable loss at ${testCurrent.quantity.value} A`
      : "No starter-family specification";
    const scenarioText=scenarioId ? " Selected model scenario remains project-authored and separate from the source-backed limit." : "";
    engineeringUi.formula.textContent=`${batteryText}. ${starterText}. Calculated equivalent cable resistance = Vdrop ÷ I = ${resistance ? (resistance.value*1000).toFixed(3)+" mΩ" : "—"}. Battery ratings and starter limits are independent source records; this lab does not assert product compatibility.${scenarioText}`;
  }

  function el(name, attrs = {}, text = "") {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text) node.textContent = text;
    return node;
  }

  function stateDefinition() {
    return circuit.operatingStates.find((state) => state.id === operatingState);
  }

  function faultObject() {
    return activeFault ? engine.getFault(circuit, activeFault) : null;
  }

  function pointForTerminal(terminalId) {
    const ownerId = terminalOwner.get(terminalId);
    const component = componentById.get(ownerId);
    const position = circuit.layout.positions[ownerId];
    const terminalDefinition = component.terminals.find((terminal) => terminal.id === terminalId);
    const symbol = symbolLibrary.registry.get(component.symbolId);
    const symbolTerminal = symbol.terminals.find((terminal) => terminal.id === terminalDefinition.symbolTerminalId);
    if (!symbolTerminal) throw new Error(`Missing symbol-terminal mapping for ${terminalId}`);
    return { x: position.x - 50 + symbolTerminal.x, y: position.y - 50 + symbolTerminal.y };
  }

  function routePath(connection) {
    const from = pointForTerminal(connection.from);
    const to = pointForTerminal(connection.to);
    if (connection.id === "W_BAT_GND" || connection.id === "W_MOTOR_GND" || connection.id === "W_SOL_COIL_GND") {
      const railY = connection.id === "W_SOL_COIL_GND" ? 500 : 555;
      return `M ${from.x} ${from.y} V ${railY} H ${to.x} V ${to.y}`;
    }
    if (connection.id === "W_BAT_CONTACT") {
      return `M ${from.x} ${from.y} V 330 H ${to.x}`;
    }
    const midX = Math.round((from.x + to.x) / 2);
    return `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
  }

  function addDefs() {
    const defs = el("defs");
    for (const [id, color] of [["arrow-power","#c62828"],["arrow-ground","#20252d"],["arrow-control","#1565c0"],["arrow-fault","#ef6c00"]]) {
      const marker = el("marker", { id, viewBox:"0 0 10 10", refX:"8", refY:"5", markerWidth:"7", markerHeight:"7", orient:"auto-start-reverse" });
      marker.append(el("path", { d:"M 0 0 L 10 5 L 0 10 z", fill:color }));
      defs.append(marker);
    }
    svg.append(defs);
  }

  function selectedFlows() {
    const state = stateDefinition();
    const flows = state.activeFlows;
    if (activeFlowMode === "system") return flows;
    return {
      power: activeFlowMode === "power" ? flows.power : [],
      ground: activeFlowMode === "ground" ? flows.ground : [],
      control: activeFlowMode === "control" ? flows.control : []
    };
  }

  function flowMap() {
    const map = new Map();
    const flows = selectedFlows();
    for (const [id, direction] of flows.power) map.set(id, { kind:"power", direction });
    for (const [id, direction] of flows.ground) map.set(id, { kind:"ground", direction });
    for (const [id, direction] of flows.control) map.set(id, { kind:"control", direction });
    return map;
  }

  function flowAllowed(connectionId) {
    const fault = faultObject();
    return !(fault && fault.type === "open_circuit" && fault.targetConnectionId === connectionId);
  }

  function renderWires() {
    const current = flowMap();
    const fault = faultObject();
    for (const connection of circuit.connections) {
      const flow = current.get(connection.id);
      const style = connectionLibrary.registry.get(connection.styleId);
      const voltageDomain = voltageDomainById.get(connection.voltageSystemId);
      const path = el("path", {
        d: routePath(connection),
        class: [
          "wire",
          `wire-role-${style.strokeRole}`,
          `voltage-domain-${voltageDomain.domainClass}`,
          connection.type.replaceAll("_","-"),
          flow && flowAllowed(connection.id) ? `flow-${flow.kind}` : "",
          flow?.direction === "reverse" ? "reverse" : "",
          fault?.targetConnectionId === connection.id && fault.type === "open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId === connection.id && fault.type === "high_resistance" ? "fault-degraded" : ""
        ].filter(Boolean).join(" "),
        style: `--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern || "none"}`,
        "data-connection-id": connection.id,
        "data-style-id": connection.styleId,
        "data-voltage-system-id": connection.voltageSystemId
      });
      if (flow && flowAllowed(connection.id)) {
        const marker = flow.kind === "power" ? "arrow-power" : flow.kind === "ground" ? "arrow-ground" : "arrow-control";
        path.setAttribute(flow.direction === "reverse" ? "marker-start" : "marker-end", `url(#${marker})`);
      } else if (fault?.targetConnectionId === connection.id) {
        path.setAttribute("marker-end", "url(#arrow-fault)");
      }
      svg.append(path);
    }
  }

  function activeComponentIds() {
    const ids = new Set(["BAT1"]);
    const current = flowMap();
    for (const connection of circuit.connections) {
      if (!current.has(connection.id) || !flowAllowed(connection.id)) continue;
      ids.add(terminalOwner.get(connection.from));
      ids.add(terminalOwner.get(connection.to));
    }
    return ids;
  }

  function componentFaulted(componentId) {
    const fault = faultObject();
    if (!fault) return false;
    const connection = circuit.connections.find((candidate) => candidate.id === fault.targetConnectionId);
    return connection && [terminalOwner.get(connection.from), terminalOwner.get(connection.to)].includes(componentId);
  }

  function renderComponents() {
    const active = activeComponentIds();
    for (const component of circuit.components) {
      const position = circuit.layout.positions[component.id];
      const group = el("g", {
        class: ["component", selectedComponentId === component.id ? "selected" : "", active.has(component.id) ? "energized" : "", componentFaulted(component.id) ? "faulted" : ""].filter(Boolean).join(" "),
        tabindex:"0",
        role:"button",
        "aria-label": component.name,
        "data-component-id": component.id
      });
      group.append(el("rect", { x:position.x-72, y:position.y-68, width:144, height:144, rx:12, class:"hit-target" }));
      const symbol = symbolLibrary.registry.get(component.symbolId);
      symbolRenderer.renderSymbol(group, symbol, { x:position.x-50, y:position.y-50, scale:1, className:"component-library-symbol", role:"presentation", ariaLabel:symbol.name });
      group.addEventListener("click", () => inspect(component.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(component.id); }
      });
      svg.append(group);
    }
  }

  function renderLabels() {
    for (const component of circuit.components) {
      const label = circuit.labels[component.id];
      const position = circuit.layout.positions[component.id];
      if (!label) continue;
      const centerX = label.x + label.width / 2;
      const centerY = label.y + label.height / 2;
      const group = el("g", { class:["component-label", selectedComponentId === component.id ? "selected" : "", componentFaulted(component.id) ? "faulted" : ""].filter(Boolean).join(" "), "data-label-for":component.id, "aria-hidden":"true" });
      group.append(el("path", { d:`M ${position.x} ${position.y} L ${centerX} ${centerY}`, class:"label-leader" }));
      group.append(el("rect", { x:label.x, y:label.y, width:label.width, height:label.height, rx:8, class:"label-chip" }));
      group.append(el("text", { x:centerX, y:label.y+20, class:"label-title" }, label.title));
      group.append(el("text", { x:centerX, y:label.y+38, class:"label-subtitle" }, label.subtitle));
      svg.append(group);
    }
  }

  function renderTestPoints() {
    circuit.testPoints.forEach((point,index) => {
      const position = pointForTerminal(point.terminalId);
      const dx = index % 2 === 0 ? 28 : -28;
      const dy = index % 2 === 0 ? -22 : 22;
      const bx = position.x + dx, by = position.y + dy;
      const group = el("g", { class:"test-point", role:"button", tabindex:"0", "aria-label":`Test point ${index+1}: ${point.id}`, "data-test-point-id":point.id });
      group.append(el("circle", { cx:position.x, cy:position.y, r:6 }));
      group.append(el("line", { x1:position.x, y1:position.y, x2:bx, y2:by, class:"label-leader" }));
      group.append(el("rect", { x:bx-18, y:by-11, width:36, height:22, rx:7, class:"tp-badge" }));
      group.append(el("text", { x:bx, y:by+1, class:"tp-label" }, `TP${index+1}`));
      group.addEventListener("click", () => inspectTestPoint(point));
      svg.append(group);
    });
  }

  function render() {
    svg.querySelectorAll("*:not(title):not(desc)").forEach((node) => node.remove());
    addDefs();
    renderWires();
    renderComponents();
    renderLabels();
    renderTestPoints();
    renderEngineering();
    const state = stateDefinition();
    stateBadge.textContent = state.label;
    flowNote.textContent = state.note + " Animated arrows are conceptual and do not represent measured magnitude.";
  }

  function updateGuide(step) {
    guideProgress = Math.max(guideProgress, step);
    guidedSteps.forEach((item,index) => {
      item.classList.toggle("complete", index < guideProgress);
      item.classList.toggle("active", index === guideProgress);
    });
  }

  function inspect(componentId) {
    selectedComponentId = componentId;
    const component = componentById.get(componentId);
    const connected = engine.getConnectedComponents(circuit, componentId, { faults: activeFault ? [activeFault] : [] });
    const points = engine.getAvailableTestPoints(circuit, componentId);
    inspector.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = component.name;
    const description = document.createElement("p");
    description.textContent = roleText[componentId] || "Reusable training component.";
    const details = document.createElement("dl");
    for (const [label,value] of [
      ["Library symbol", component.symbolId],
      ["Voltage domain", component.voltageSystemId],
      ["Terminals", component.terminals.map((terminal) => terminal.name).join(", ")],
      ["Connected to", connected.length ? connected.map((id) => componentById.get(id)?.name || id).join(", ") : "No connection under current fault state"],
      ["Test points", points.length ? points.map((point) => point.id).join(", ") : "None"]
    ]) {
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = value;
      details.append(dt,dd);
    }
    inspector.append(heading,description,details);
    updateGuide(componentId === "BAT1" ? 1 : componentId.startsWith("SOL_") ? 3 : componentId === "MTR1" ? 4 : 2);
    render();
  }

  function inspectTestPoint(point) {
    inspector.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = point.id;
    const text = document.createElement("p");
    text.textContent = `Available conceptual measurement types: ${point.measurementTypes.join(", ")}. Vehicle-specific values and limits are intentionally not supplied.`;
    inspector.append(heading,text);
  }

  stateSelect.addEventListener("change", () => { operatingState = stateSelect.value; activeFlowMode = "system"; render(); });
  faultSelect.addEventListener("change", () => { activeFault = faultSelect.value; updateGuide(activeFault ? 5 : guideProgress); render(); });
  engineeringUi.batterySelect.addEventListener("change", renderEngineering);
  engineeringUi.starterSelect.addEventListener("change", renderEngineering);
  engineeringUi.modelScenario.addEventListener("change", renderEngineering);
  engineeringUi.measuredDrop.addEventListener("input", renderEngineering);
  engineeringUi.measuredDrop.addEventListener("change", renderEngineering);
  document.getElementById("showSystemFlow").addEventListener("click", () => { activeFlowMode = "system"; render(); });
  document.getElementById("traceControl").addEventListener("click", () => { activeFlowMode = "control"; updateGuide(2); render(); });
  document.getElementById("tracePower").addEventListener("click", () => { activeFlowMode = "power"; updateGuide(4); render(); });
  document.getElementById("traceGround").addEventListener("click", () => { activeFlowMode = "ground"; render(); });
  document.getElementById("resetView").addEventListener("click", () => {
    operatingState = "crank";
    stateSelect.value = "crank";
    activeFault = "";
    faultSelect.value = "";
    engineeringUi.modelScenario.value = "";
    selectedComponentId = "";
    activeFlowMode = "system";
    guideProgress = 0;
    inspector.innerHTML = "<p>Select a symbol or test point to inspect its role in the reusable training template.</p>";
    render();
  });

  render();
})().catch((error) => {
  console.error(error);
  const target = document.getElementById("inspectorContent");
  if (target) target.textContent = "The starting-system template could not be loaded.";
});
