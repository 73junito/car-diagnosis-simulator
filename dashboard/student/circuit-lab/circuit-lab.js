"use strict";

(async function initCircuitLab() {
  const NS = "http://www.w3.org/2000/svg";
  const engine = window.TorqueMindCircuitEngine;
  const [response, delcoResponse] = await Promise.all([
    fetch("/data/circuits/generic-charging-system.json"),
    fetch("/data/engineering/authoritative-specifications/delco-remy-starting-charging.json")
  ]);
  if (!response.ok) throw new Error("Unable to load training circuit.");
  if (!delcoResponse.ok) throw new Error("Unable to load charging engineering references.");
  const circuit = await response.json();
  const delcoCatalog = await delcoResponse.json();
  const validation = engine.validateCircuit(circuit);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const symbolLibrary = await window.TorqueMindSymbolLibrary.loadCatalogs("/data/symbols");
  const symbolRenderer = window.TorqueMindSymbolRenderer;
  const connectionLibrary = await window.TorqueMindConnectionLibrary.loadConnectionStyles("/data/connections");
  const voltageDomains = window.TorqueMindVoltageDomains;
  const engineering = window.TorqueMindEngineering;
  const calculator = engineering.calculator;

  const svg = document.getElementById("circuitSvg");
  const inspector = document.getElementById("inspectorContent");
  const faultSelect = document.getElementById("faultSelect");
  const stateSelect = document.getElementById("stateSelect");
  const stateBadge = document.getElementById("stateBadge");
  const voltageProfile = document.getElementById("voltageProfile");
  const guidedSteps = [...document.querySelectorAll("#guidedSteps li")];

  const voltageArchitecture = voltageDomains.describeVoltageArchitecture(circuit);
  const voltageDomainById = new Map(voltageArchitecture.map((domain) => [domain.id, domain]));

  for (const domain of voltageArchitecture) {
    const chip = document.createElement("span");
    chip.className = `voltage-chip voltage-domain-${domain.domainClass}`;
    chip.dataset.voltageSystemId = domain.id;
    const systemLabel = document.createElement("small");
    systemLabel.textContent = domain.powertrainLabel;
    const voltageLabel = document.createElement("span");
    voltageLabel.textContent = domain.label;
    chip.append(systemLabel, voltageLabel);
    voltageProfile.append(chip);
  }

  let activeFault = "";
  let operatingState = stateSelect.value;
  let selectedComponentId = "";
  let activeFlow = null;
  let guideProgress = 0;

  const componentById = new Map(circuit.components.map((item) => [item.id, item]));
  const terminalOwner = new Map();
  for (const component of circuit.components) {
    for (const terminal of component.terminals) terminalOwner.set(terminal.id, component.id);
  }

  const stateLabels = {
    "key-off": "Key off",
    "key-on": "Key on",
    "engine-running": "Engine running / charging"
  };

  const roleText = {
    battery: "Electrical energy source and storage device for this generic training circuit.",
    fusible_link: "Primary circuit protection between the battery feed and charging/load branches.",
    alternator: "Electrical generator represented as the charging source when the engine-running state is selected.",
    regulator: "Control element that represents regulation of charging-system operation.",
    load: "A simplified symbol representing vehicle electrical loads consuming electrical energy.",
    ground: "Common chassis return reference for the generic circuit."
  };

  const engineeringUi = {
    status: document.getElementById("chargingEngineeringStatus"),
    referenceSelect: document.getElementById("chargingReferenceSelect"),
    currentInput: document.getElementById("chargingCurrentInput"),
    drop: document.getElementById("engChargingDrop"),
    dropLabel: document.getElementById("engChargingDropLabel"),
    current: document.getElementById("engChargingCurrent"),
    resistance: document.getElementById("engChargingResistance"),
    formula: document.getElementById("chargingEngineeringFormula")
  };

  const chargingReferenceLabels = Object.freeze({
    "delco-charging-cable-new-vehicle-design-drop-12v": "New-vehicle design basis",
    "delco-charging-cable-life-max-drop-12v": "Vehicle-life maximum",
    "delco-charging-3wire-number2-lead-max-drop-12v": "3-wire #2 lead maximum"
  });

  function selectedChargingReference() {
    return delcoCatalog.specifications.find((entry) => entry.id === engineeringUi.referenceSelect.value) || null;
  }

  function enteredCurrent() {
    const raw = engineeringUi.currentInput.value.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function renderEngineering() {
    const reference = selectedChargingReference();
    const current = enteredCurrent();
    const fault = faultObject();
    const dropValue = reference?.quantity?.value;
    const resistance = reference && current
      ? calculator.solveOhmsLaw({ voltage: dropValue, current })
      : null;

    engineeringUi.drop.textContent = reference ? `${dropValue.toFixed(3)} V` : "—";
    engineeringUi.dropLabel.textContent = reference
      ? chargingReferenceLabels[reference.id] || reference.parameter
      : "No source reference";
    engineeringUi.current.textContent = current ? `${Number(current.toFixed(2))} A` : "—";
    engineeringUi.resistance.textContent = resistance ? `${(resistance.value * 1000).toFixed(3)} mΩ` : "—";

    if (!reference) {
      engineeringUi.status.textContent = "No charging reference selected";
      engineeringUi.status.className = "engineering-status inactive";
    } else if (fault?.type === "open_circuit") {
      engineeringUi.status.textContent = "Open path — no fault voltage drop inferred";
      engineeringUi.status.className = "engineering-status fault";
    } else if (fault?.id === "FAULT_HIGH_RES_GROUND") {
      engineeringUi.status.textContent = "Ground path degraded — selected cable reference may not apply";
      engineeringUi.status.className = "engineering-status fault";
    } else {
      engineeringUi.status.textContent = "Reference loaded";
      engineeringUi.status.className = "engineering-status";
    }

    const scope = reference?.applicability?.wiringConfiguration
      ? `${reference.applicability.wiringConfiguration}, ${reference.applicability.conductor || "specified conductor"}`
      : reference?.applicability?.testMethod || "charging-cable guidance";
    const comparison = reference?.comparison === "design_basis" ? "design basis" : "maximum";
    const calculationText = resistance
      ? `Entered current ${Number(current.toFixed(2))} A gives R = ${dropValue.toFixed(3)} V ÷ ${Number(current.toFixed(2))} A = ${(resistance.value * 1000).toFixed(3)} mΩ.`
      : "Enter a positive current value to calculate equivalent resistance from the selected source-backed voltage-drop reference.";
    const faultText = fault?.type === "open_circuit"
      ? " The injected open circuit does not receive a fabricated voltage-drop value."
      : fault?.id === "FAULT_HIGH_RES_GROUND"
        ? " The injected alternator-ground fault is a different path; do not apply this charging-cable reference to it without matching source applicability."
        : "";
    engineeringUi.formula.textContent = reference
      ? `${chargingReferenceLabels[reference.id]}: ${dropValue.toFixed(3)} V ${comparison}; scope: ${scope}. ${calculationText}${faultText}`
      : "No source-backed charging reference is available.";
  }

  const systemFlows = {
    "key-off": {
      power: [],
      ground: [],
      control: [],
      note: "Key off: no continuous operating current is animated. The battery remains the source, but flow is not implied without an active load."
    },
    "key-on": {
      power: [
        ["W_BAT_FUSE", "forward"],
        ["W_FUSE_LOAD", "forward"]
      ],
      ground: [
        ["W_LOAD_GND", "forward"],
        ["W_BAT_GND", "reverse"]
      ],
      control: [
        ["W_REG_CTRL", "forward"],
        ["W_ALT_REG", "reverse"]
      ],
      note: "Key on: conventional current is shown from battery positive through protection to the electrical load, then through the ground return toward battery negative. The dashed blue path represents control, not load current."
    },
    "engine-running": {
      power: [
        ["W_FUSE_ALT", "reverse"],
        ["W_BAT_FUSE", "reverse"],
        ["W_FUSE_LOAD", "forward"]
      ],
      ground: [
        ["W_LOAD_GND", "forward"],
        ["W_BAT_GND", "reverse"],
        ["W_ALT_GND", "reverse"]
      ],
      control: [
        ["W_REG_CTRL", "forward"],
        ["W_ALT_REG", "reverse"]
      ],
      note: "Engine running: the alternator is represented as a charging source. Conventional current is animated from alternator B+ toward the protected battery/load branches, with return paths shown toward ground."
    }
  };

  for (const fault of circuit.faultCatalog || []) {
    const option = document.createElement("option");
    option.value = fault.id;
    option.textContent = fault.label;
    faultSelect.append(option);
  }

  function el(name, attrs = {}, text = "") {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text) node.textContent = text;
    return node;
  }

  function addDefs() {
    const defs = el("defs");
    for (const [id, color] of [
      ["arrow-power", "#c62828"],
      ["arrow-ground", "#20252d"],
      ["arrow-control", "#1565c0"],
      ["arrow-fault", "#ef6c00"]
    ]) {
      const marker = el("marker", {
        id, viewBox: "0 0 10 10", refX: "8", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      marker.append(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
      defs.append(marker);
    }
    svg.append(defs);
  }

  const terminalSymbolIds = Object.freeze({
    BAT1_POS: "positive",
    BAT1_NEG: "negative",
    FUSE1_IN: "in",
    FUSE1_OUT: "out",
    ALT1_BPLUS: "output",
    ALT1_CTRL: "control",
    ALT1_GND: "ground",
    REG1_ALT: "output",
    REG1_CTRL: "input",
    LOAD1_PWR: "a",
    LOAD1_GND: "b",
    GND1_MAIN: "ground"
  });

  function pointForTerminal(terminalId) {
    const owner = terminalOwner.get(terminalId);
    const pos = circuit.layout.positions[owner];
    const symbol = symbolLibrary.registry.get(componentSymbolIds[owner]);
    const symbolTerminalId = terminalSymbolIds[terminalId];
    const terminal = symbol?.terminals?.find((item) => item.id === symbolTerminalId);
    if (!terminal) throw new Error(`Missing standardized terminal mapping for ${terminalId}`);
    return {
      x: pos.x - 50 + terminal.x,
      y: pos.y - 50 + terminal.y
    };
  }

  function routePath(connection) {
    const from = pointForTerminal(connection.from);
    const to = pointForTerminal(connection.to);
    if (connection.id === "W_BAT_GND") {
      return `M ${from.x} ${from.y} V 520 H ${to.x} V ${to.y}`;
    }
    if (connection.id === "W_LOAD_GND") {
      return `M ${from.x} ${from.y} V 520 H ${to.x} V ${to.y}`;
    }
    if (connection.id === "W_ALT_GND") {
      return `M ${from.x} ${from.y} V ${to.y}`;
    }
    if (connection.type === "control") {
      const midY = (from.y + to.y) / 2;
      return `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}`;
    }
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
  }

  function faultObject() {
    return activeFault ? engine.getFault(circuit, activeFault) : null;
  }

  function currentFlowMap() {
    const flow = new Map();
    if (!activeFlow) return flow;
    for (const [id, direction] of activeFlow.power || []) flow.set(id, { kind: "power", direction });
    for (const [id, direction] of activeFlow.ground || []) flow.set(id, { kind: "ground", direction });
    for (const [id, direction] of activeFlow.control || []) flow.set(id, { kind: "control", direction });
    return flow;
  }

  function flowAllowed(connectionId) {
    const fault = faultObject();
    return !(fault && fault.targetConnectionId === connectionId && fault.type === "open_circuit");
  }

  function renderWires() {
    const flow = currentFlowMap();
    const fault = faultObject();

    for (const connection of circuit.connections) {
      const state = flow.get(connection.id);
      const style = connectionLibrary.registry.get(connection.styleId);
      if (!style) throw new Error(`Missing connection style: ${connection.styleId}`);
      const voltageDomain = voltageDomainById.get(connection.voltageSystemId);
      if (!voltageDomain) throw new Error(`Missing voltage domain: ${connection.voltageSystemId}`);
      const path = el("path", {
        d: routePath(connection),
        class: [
          "wire",
          `wire-role-${style.strokeRole}`,
          `voltage-domain-${voltageDomain.domainClass}`,
          connection.type.replaceAll("_", "-"),
          state && flowAllowed(connection.id) ? `flow-${state.kind}` : "",
          state?.direction === "reverse" ? "reverse" : "",
          fault?.targetConnectionId === connection.id && fault.type === "open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId === connection.id && fault.type === "high_resistance" ? "fault-degraded" : "",
          operatingState === "key-off" && connection.type !== "power_feed" ? "inactive" : ""
        ].filter(Boolean).join(" "),
        style: `--wire-width:${style.strokeWidth};--wire-dash:${style.dashPattern || "none"}`,
        "data-connection-id": connection.id,
        "data-style-id": connection.styleId,
        "data-voltage-system-id": connection.voltageSystemId
      });

      if (state && flowAllowed(connection.id)) {
        const marker = state.kind === "power" ? "arrow-power" : state.kind === "ground" ? "arrow-ground" : "arrow-control";
        path.setAttribute(state.direction === "reverse" ? "marker-start" : "marker-end", `url(#${marker})`);
      } else if (fault?.targetConnectionId === connection.id) {
        path.setAttribute("marker-end", "url(#arrow-fault)");
      }
      svg.append(path);
    }
  }

  const componentSymbolIds = Object.freeze({
    BAT1: "electrical.battery",
    FUSE1: "electrical.fuse",
    ALT1: "electrical.alternator",
    REG1: "electrical.voltage-regulator",
    LOAD1: "electrical.lamp",
    GND1: "electrical.ground"
  });

  const externalLabels = Object.freeze({
    BAT1: { x: 4, y: 320, width: 140, height: 50, title: "Battery", subtitle: "electrical source", anchor: { x: 90, y: 292 } },
    FUSE1: { x: 206, y: 0, width: 168, height: 44, title: "Main protection", subtitle: "fusible link", anchor: { x: 290, y: 58 } },
    ALT1: { x: 610, y: 30, width: 176, height: 52, title: "Alternator", subtitle: "generator / rectifier", anchor: { x: 598, y: 90 } },
    REG1: { x: 610, y: 254, width: 180, height: 52, title: "Voltage regulator", subtitle: "control", anchor: { x: 598, y: 280 } },
    LOAD1: { x: 840, y: 94, width: 134, height: 52, title: "Electrical loads", subtitle: "generic load symbol", anchor: { x: 814, y: 120 } },
    GND1: { x: 432, y: 550, width: 176, height: 52, title: "Chassis ground", subtitle: "return reference", anchor: { x: 520, y: 498 } }
  });

  function renderLibrarySymbol(group, component, pos) {
    const symbolId = componentSymbolIds[component.id];
    const symbol = symbolLibrary.registry.get(symbolId);
    if (!symbol) throw new Error(`Missing standardized symbol: ${symbolId}`);
    symbolRenderer.renderSymbol(group, symbol, {
      x: pos.x - 50,
      y: pos.y - 50,
      scale: 1,
      className: "component-library-symbol",
      role: "presentation",
      ariaLabel: symbol.name
    });
  }

  function renderExternalLabel(component) {
    const label = externalLabels[component.id];
    if (!label) return;
    const group = el("g", {
      class: [
        "component-label",
        selectedComponentId === component.id ? "selected" : "",
        componentFaulted(component.id) ? "faulted" : ""
      ].filter(Boolean).join(" "),
      "data-label-for": component.id,
      "aria-hidden": "true"
    });
    const centerX = label.x + label.width / 2;
    const centerY = label.y + label.height / 2;
    group.append(el("path", {
      d: `M ${label.anchor.x} ${label.anchor.y} L ${centerX} ${centerY}`,
      class: "label-leader"
    }));
    group.append(el("rect", {
      x: label.x, y: label.y, width: label.width, height: label.height,
      rx: 8, class: "label-chip"
    }));
    group.append(el("text", {
      x: centerX, y: label.y + 20, class: "label-title"
    }, label.title));
    group.append(el("text", {
      x: centerX, y: label.y + 38, class: "label-subtitle"
    }, label.subtitle));
    svg.append(group);
  }

  function isComponentEnergized(id) {
    if (id === "BAT1") return true;
    if (operatingState === "key-off") return false;
    if (operatingState === "key-on") return ["FUSE1","LOAD1","REG1"].includes(id);
    return ["FUSE1","LOAD1","REG1","ALT1"].includes(id);
  }

  function componentFaulted(id) {
    const fault = faultObject();
    if (!fault) return false;
    const connection = circuit.connections.find((item) => item.id === fault.targetConnectionId);
    return connection && [terminalOwner.get(connection.from), terminalOwner.get(connection.to)].includes(id);
  }

  function renderComponents() {
    for (const component of circuit.components) {
      const pos = circuit.layout.positions[component.id];
      const group = el("g", {
        class: [
          "component",
          selectedComponentId === component.id ? "selected" : "",
          isComponentEnergized(component.id) ? "energized" : "",
          componentFaulted(component.id) ? "faulted" : ""
        ].filter(Boolean).join(" "),
        tabindex:"0",
        role:"button",
        "aria-label":`${component.name}, ${component.type}`,
        "data-component-id":component.id
      });

      group.append(el("rect", {
        x: pos.x - 78, y: pos.y - 72, width: 156, height: 156,
        class: "hit-target", rx: 12
      }));
      renderLibrarySymbol(group, component, pos);
      group.addEventListener("click", () => inspect(component.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inspect(component.id);
        }
      });
      svg.append(group);
    }
  }

  function renderExternalLabels() {
    for (const component of circuit.components) renderExternalLabel(component);
  }

  function renderTestPoints() {
    (circuit.testPoints || []).forEach((point,index) => {
      const p = pointForTerminal(point.terminalId);
      const dx = index % 2 === 0 ? 28 : -28;
      const dy = index % 2 === 0 ? -22 : 22;
      const bx = p.x + dx, by = p.y + dy;
      const group = el("g", {
        class:"test-point",
        role:"button",
        tabindex:"0",
        "aria-label":`Test point ${index+1}: ${point.id}`,
        "data-test-point-id":point.id
      });
      group.append(el("circle", { cx:p.x, cy:p.y, r:6 }));
      group.append(el("line", { x1:p.x, y1:p.y, x2:bx, y2:by, class:"label-leader" }));
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
    renderExternalLabels();
    renderTestPoints();
    renderEngineering();
    stateBadge.textContent = stateLabels[operatingState];
  }

  function updateGuide(index) {
    guideProgress = Math.max(guideProgress, index);
    guidedSteps.forEach((item, i) => {
      item.classList.toggle("complete", i < guideProgress);
      item.classList.toggle("active", i === guideProgress);
    });
  }

  function updateSelectedVisual() {
    svg.querySelectorAll(".component").forEach((node) => {
      node.classList.toggle("selected", node.dataset.componentId === selectedComponentId);
    });
    svg.querySelectorAll(".component-label").forEach((node) => {
      node.classList.toggle("selected", node.dataset.labelFor === selectedComponentId);
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
    const role = document.createElement("p");
    role.textContent = roleText[component.type] || "Generic training component.";

    const list = document.createElement("dl");
    for (const [label, value] of [
      ["Symbol", component.type.replaceAll("_", " ")],
      ["Terminals", component.terminals.map((item) => item.name).join(", ")],
      ["Connected to", connected.length ? connected.map((id) => componentById.get(id)?.name || id).join(", ") : "No connection under current fault state"],
      ["Test points", points.length ? points.map((item) => item.id).join(", ") : "None"],
      ["State", isComponentEnergized(componentId) ? "Active/energized in this conceptual state" : "Not shown active in this conceptual state"]
    ]) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    }
    inspector.append(heading, role, list);

    if (componentId === "BAT1") updateGuide(1);
    if (componentId === "FUSE1") updateGuide(2);
    updateSelectedVisual();
  }

  function inspectTestPoint(point) {
    const ownerId = terminalOwner.get(point.terminalId);
    const owner = componentById.get(ownerId);
    inspector.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = `Test point ${point.id}`;
    const body = document.createElement("p");
    body.textContent = `Located at ${owner.name}. Available measurement type(s): ${point.measurementTypes.join(", ")}.`;
    const warning = document.createElement("p");
    warning.textContent = "Vehicle-specific authoritative service information is required for the expected value or procedure.";
    inspector.append(heading, body, warning);
  }

  function applySystemFlow() {
    activeFlow = systemFlows[operatingState];
    inspector.textContent = activeFlow.note;
    document.getElementById("flowNote").textContent = activeFlow.note;
    render();
  }

  function traceBatteryAlternator() {
    const result = engine.tracePath(circuit, "BAT1_POS", "ALT1_BPLUS", { faults: activeFault ? [activeFault] : [] });
    if (!result.found) {
      activeFlow = null;
      inspector.textContent = "The B+ path is open under the current injected fault. The orange interrupted conductor identifies the affected connection.";
      updateGuide(5);
      render();
      return;
    }
    const reverse = operatingState === "engine-running";
    activeFlow = { power: result.connections.map((id) => [id, reverse ? "reverse" : "forward"]), ground: [], control: [] };
    inspector.textContent = reverse
      ? "B+ path continuity exists. In the engine-running training state, conventional charging flow is shown from the alternator toward the protected battery branch."
      : "B+ path continuity exists between the battery and alternator through the main charging protection.";
    updateGuide(3);
    render();
  }

  function traceGround() {
    const result = engine.tracePath(circuit, "ALT1_GND", "GND1_MAIN", { faults: activeFault ? [activeFault] : [] });
    if (!result.found) {
      activeFlow = null;
      inspector.textContent = "No continuous alternator-to-ground path exists under the current fault state.";
      render();
      return;
    }
    activeFlow = {
      power: [],
      ground: result.connections.map((id) => [id, operatingState === "engine-running" ? "reverse" : "forward"]),
      control: []
    };
    inspector.textContent = result.degraded
      ? "The ground path remains connected, but the injected high-resistance fault marks it as degraded. A real diagnosis would require an evidence-supported measurement."
      : "The alternator ground path is continuous in the generic circuit model.";
    updateGuide(4);
    render();
  }

  document.getElementById("showSystemFlow").addEventListener("click", applySystemFlow);
  document.getElementById("tracePower").addEventListener("click", traceBatteryAlternator);
  document.getElementById("traceGround").addEventListener("click", traceGround);

  document.getElementById("resetView").addEventListener("click", () => {
    selectedComponentId = "";
    activeFlow = null;
    inspector.innerHTML = "<p>Select an electrical symbol to inspect its role, terminals, connections, and available test points.</p>";
    document.getElementById("flowNote").textContent = "Animated arrows show conventional current direction. They are conceptual training aids, not measured current magnitude.";
    render();
  });

  faultSelect.addEventListener("change", () => {
    activeFault = faultSelect.value;
    activeFlow = null;
    const fault = faultObject();
    inspector.textContent = fault
      ? `Injected training fault: ${fault.label}. The circuit definition itself remains unchanged. Select a trace to observe its effect.`
      : "No training fault is injected.";
    if (activeFault === "FAULT_OPEN_CHARGE_FEED") updateGuide(4);
    render();
  });

  engineeringUi.referenceSelect.addEventListener("change", renderEngineering);
  engineeringUi.currentInput.addEventListener("input", renderEngineering);
  engineeringUi.currentInput.addEventListener("change", renderEngineering);

  stateSelect.addEventListener("change", () => {
    operatingState = stateSelect.value;
    selectedComponentId = "";
    applySystemFlow();
  });

  applySystemFlow();
})();
