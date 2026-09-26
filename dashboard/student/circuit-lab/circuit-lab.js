"use strict";

(async function initCircuitLab() {
  const NS = "http://www.w3.org/2000/svg";
  const engine = window.TorqueMindCircuitEngine;
  const response = await fetch("/data/circuits/generic-charging-system.json");
  if (!response.ok) throw new Error("Unable to load training circuit.");
  const circuit = await response.json();
  const validation = engine.validateCircuit(circuit);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const svg = document.getElementById("circuitSvg");
  const inspector = document.getElementById("inspectorContent");
  const faultSelect = document.getElementById("faultSelect");
  const stateSelect = document.getElementById("stateSelect");
  const stateBadge = document.getElementById("stateBadge");
  const guidedSteps = [...document.querySelectorAll("#guidedSteps li")];

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

  const anchors = {
    BAT1_POS: { dx: 62, dy: -18 }, BAT1_NEG: { dx: 62, dy: 18 },
    FUSE1_IN: { dx: -64, dy: 0 }, FUSE1_OUT: { dx: 64, dy: 0 },
    ALT1_BPLUS: { dx: -62, dy: -18 }, ALT1_CTRL: { dx: -62, dy: 20 }, ALT1_GND: { dx: 0, dy: 62 },
    REG1_ALT: { dx: 0, dy: -45 }, REG1_CTRL: { dx: -62, dy: 0 },
    LOAD1_PWR: { dx: -58, dy: -18 }, LOAD1_GND: { dx: -58, dy: 18 },
    GND1_MAIN: { dx: 0, dy: -48 }
  };

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

  function pointForTerminal(terminalId) {
    const owner = terminalOwner.get(terminalId);
    const pos = circuit.layout.positions[owner];
    const anchor = anchors[terminalId] || { dx: 0, dy: 0 };
    return { x: pos.x + anchor.dx, y: pos.y + anchor.dy };
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
      const path = el("path", {
        d: routePath(connection),
        class: [
          "wire",
          connection.type.replaceAll("_", "-"),
          connection.type === "control" ? "control" : "",
          state && flowAllowed(connection.id) ? `flow-${state.kind}` : "",
          state?.direction === "reverse" ? "reverse" : "",
          fault?.targetConnectionId === connection.id && fault.type === "open_circuit" ? "fault-open" : "",
          fault?.targetConnectionId === connection.id && fault.type === "high_resistance" ? "fault-degraded" : "",
          operatingState === "key-off" && connection.type !== "power_feed" ? "inactive" : ""
        ].filter(Boolean).join(" "),
        "data-connection-id": connection.id
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

  function addLabel(group, x, y, title, subtitle) {
    group.append(el("text", { x, y, class: "symbol-label" }, title));
    if (subtitle) group.append(el("text", { x, y: y + 18, class: "symbol-sub" }, subtitle));
  }

  function symbolBattery(group, x, y) {
    group.append(el("line", { x1:x-14, y1:y-32, x2:x-14, y2:y+32, class:"symbol-stroke" }));
    group.append(el("line", { x1:x+14, y1:y-21, x2:x+14, y2:y+21, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-62, y1:y-18, x2:x-14, y2:y-18, class:"symbol-stroke" }));
    group.append(el("line", { x1:x+14, y1:y+18, x2:x+62, y2:y+18, class:"symbol-stroke" }));
    group.append(el("text", { x:x-34, y:y-27, class:"symbol-sub" }, "+"));
    group.append(el("text", { x:x+34, y:y+32, class:"symbol-sub" }, "−"));
    addLabel(group, x, y+60, "Battery", "electrical source");
  }

  function symbolFuse(group, x, y) {
    group.append(el("line", { x1:x-64, y1:y, x2:x-34, y2:y, class:"symbol-stroke" }));
    group.append(el("rect", { x:x-34, y:y-16, width:68, height:32, rx:4, class:"symbol-fill" }));
    group.append(el("path", { d:`M ${x-24} ${y+7} L ${x-8} ${y-7} L ${x+8} ${y+7} L ${x+24} ${y-7}`, class:"symbol-stroke" }));
    group.append(el("line", { x1:x+34, y1:y, x2:x+64, y2:y, class:"symbol-stroke" }));
    addLabel(group, x, y+44, "Main protection", "fusible link");
  }

  function symbolAlternator(group, x, y) {
    group.append(el("circle", { cx:x, cy:y, r:54, class:"symbol-fill" }));
    group.append(el("path", { d:`M ${x-30} ${y} C ${x-20} ${y-22}, ${x-8} ${y-22}, ${x} ${y} S ${x+20} ${y+22}, ${x+30} ${y}`, class:"symbol-stroke" }));
    group.append(el("text", { x, y:y-16, class:"symbol-sub" }, "AC"));
    addLabel(group, x, y+78, "Alternator", "generator / rectifier");
  }

  function symbolRegulator(group, x, y) {
    group.append(el("rect", { x:x-58, y:y-38, width:116, height:76, rx:8, class:"symbol-fill" }));
    group.append(el("path", { d:`M ${x-35} ${y+12} H ${x-20} L ${x-10} ${y-12} L ${x+2} ${y+12} L ${x+14} ${y-12} L ${x+25} ${y+12} H ${x+35}`, class:"symbol-stroke" }));
    addLabel(group, x, y+62, "Voltage regulator", "control");
  }

  function symbolLoad(group, x, y) {
    group.append(el("circle", { cx:x, cy:y, r:43, class:"symbol-fill" }));
    group.append(el("line", { x1:x-28, y1:y-28, x2:x+28, y2:y+28, class:"symbol-stroke" }));
    group.append(el("line", { x1:x+28, y1:y-28, x2:x-28, y2:y+28, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-58, y1:y-18, x2:x-43, y2:y-18, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-58, y1:y+18, x2:x-43, y2:y+18, class:"symbol-stroke" }));
    addLabel(group, x, y+68, "Electrical loads", "generic load symbol");
  }

  function symbolGround(group, x, y) {
    group.append(el("line", { x1:x, y1:y-48, x2:x, y2:y-4, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-38, y1:y, x2:x+38, y2:y, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-26, y1:y+12, x2:x+26, y2:y+12, class:"symbol-stroke" }));
    group.append(el("line", { x1:x-14, y1:y+24, x2:x+14, y2:y+24, class:"symbol-stroke" }));
    addLabel(group, x, y+50, "Chassis ground", "return reference");
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
    const renderers = {
      battery: symbolBattery,
      fusible_link: symbolFuse,
      alternator: symbolAlternator,
      regulator: symbolRegulator,
      load: symbolLoad,
      ground: symbolGround
    };

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
      (renderers[component.type] || symbolRegulator)(group, pos.x, pos.y);
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

  function renderTestPoints() {
    for (const point of circuit.testPoints || []) {
      const p = pointForTerminal(point.terminalId);
      const group = el("g", {
        class:"test-point",
        role:"button",
        tabindex:"0",
        "aria-label":`Test point ${point.id}`
      });
      group.append(el("circle", { cx:p.x, cy:p.y, r:8 }));
      group.append(el("text", { x:p.x+12, y:p.y-10 }, "TP"));
      group.addEventListener("click", () => inspectTestPoint(point));
      svg.append(group);
    }
  }

  function render() {
    svg.querySelectorAll("*:not(title):not(desc)").forEach((node) => node.remove());
    addDefs();
    renderWires();
    renderComponents();
    renderTestPoints();
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

  stateSelect.addEventListener("change", () => {
    operatingState = stateSelect.value;
    selectedComponentId = "";
    applySystemFlow();
  });

  applySystemFlow();
})();
