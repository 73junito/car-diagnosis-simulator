"use strict";

(async function initCircuitLab() {
  const engine = window.TorqueMindCircuitEngine;
  const response = await fetch("/data/circuits/generic-charging-system.json");
  if (!response.ok) throw new Error("Unable to load training circuit.");
  const circuit = await response.json();
  const validation = engine.validateCircuit(circuit);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const svg = document.getElementById("circuitSvg");
  const inspector = document.getElementById("inspectorContent");
  const faultSelect = document.getElementById("faultSelect");
  let activeFault = "";
  let selectedComponentId = "";

  const terminalIndex = new Map();
  for (const component of circuit.components) {
    component.terminals.forEach((terminal, index) => terminalIndex.set(terminal.id, { component, index }));
  }

  for (const fault of circuit.faultCatalog || []) {
    const option = document.createElement("option");
    option.value = fault.id;
    option.textContent = fault.label;
    faultSelect.append(option);
  }

  function pointForTerminal(terminalId) {
    const { component, index } = terminalIndex.get(terminalId);
    const pos = circuit.layout.positions[component.id];
    const count = component.terminals.length;
    const offset = count === 1 ? 0 : (index - (count - 1) / 2) * 28;
    if (component.type === "ground") return { x: pos.x, y: pos.y - 35 };
    if (component.type === "battery") return { x: pos.x + 65, y: pos.y + offset };
    if (component.type === "load") return { x: pos.x - 65, y: pos.y + offset };
    return { x: pos.x + (index % 2 === 0 ? -65 : 65), y: pos.y + offset };
  }

  const currentFaults = () => activeFault ? [activeFault] : [];

  function render(highlightConnections = []) {
    svg.querySelectorAll("*:not(title):not(desc)").forEach((node) => node.remove());
    const activeFaultObject = activeFault ? engine.getFault(circuit, activeFault) : null;

    for (const connection of circuit.connections) {
      const from = pointForTerminal(connection.from);
      const to = pointForTerminal(connection.to);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const midX = (from.x + to.x) / 2;
      line.setAttribute("d", `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`);
      line.setAttribute("class", [
        "wire",
        connection.type === "control" ? "control" : "",
        highlightConnections.includes(connection.id) ? "highlight" : "",
        activeFaultObject?.targetConnectionId === connection.id && activeFaultObject.type === "high_resistance" ? "degraded" : ""
      ].filter(Boolean).join(" "));
      if (activeFaultObject?.targetConnectionId === connection.id && activeFaultObject.type === "open_circuit") {
        line.setAttribute("stroke-dasharray", "18 14");
      }
      svg.append(line);
    }

    for (const component of circuit.components) {
      const pos = circuit.layout.positions[component.id];
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", `component${selectedComponentId === component.id ? " selected" : ""}`);
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", `${component.name}, ${component.type}`);

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", pos.x - 65);
      rect.setAttribute("y", pos.y - 35);
      rect.setAttribute("width", 130);
      rect.setAttribute("height", 70);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", pos.x);
      text.setAttribute("y", pos.y + 5);
      text.textContent = component.name;

      group.append(rect, text);
      group.addEventListener("click", () => inspect(component.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") inspect(component.id);
      });
      svg.append(group);
    }
  }

  function inspect(componentId) {
    selectedComponentId = componentId;
    const component = circuit.components.find((item) => item.id === componentId);
    const connected = engine.getConnectedComponents(circuit, componentId, { faults: currentFaults() });
    const points = engine.getAvailableTestPoints(circuit, componentId);
    inspector.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = component.name;
    const meta = document.createElement("p");
    meta.textContent = `Type: ${component.type}`;
    const terminals = document.createElement("p");
    terminals.textContent = `Terminals: ${component.terminals.map((item) => item.name).join(", ")}`;
    const neighbors = document.createElement("p");
    neighbors.textContent = `Connected components: ${connected.length ? connected.join(", ") : "none under current fault state"}`;
    const tests = document.createElement("p");
    tests.textContent = points.length
      ? `Available training test points: ${points.map((item) => item.id).join(", ")}. Vehicle-specific values are intentionally not provided.`
      : "No training test point is attached to this component.";
    inspector.append(heading, meta, terminals, neighbors, tests);
    render();
  }

  document.getElementById("tracePower").addEventListener("click", () => {
    const result = engine.tracePath(circuit, "BAT1_POS", "ALT1_BPLUS", { faults: currentFaults() });
    inspector.textContent = result.found
      ? `Power path found through: ${result.connections.join(" → ")}${result.degraded ? ". A high-resistance fault is present on this path." : "."}`
      : "No continuous battery-to-alternator path exists under the current injected fault.";
    render(result.connections);
  });

  document.getElementById("traceGround").addEventListener("click", () => {
    const result = engine.tracePath(circuit, "ALT1_GND", "GND1_MAIN", { faults: currentFaults() });
    inspector.textContent = result.found
      ? `Ground path found through: ${result.connections.join(" → ")}${result.degraded ? ". A high-resistance fault is present on this path." : "."}`
      : "No continuous alternator-ground path exists under the current injected fault.";
    render(result.connections);
  });

  document.getElementById("resetView").addEventListener("click", () => {
    selectedComponentId = "";
    inspector.textContent = "Select a component to inspect its terminals, connected components, and available test points.";
    render();
  });

  faultSelect.addEventListener("change", () => {
    activeFault = faultSelect.value;
    const fault = activeFault ? engine.getFault(circuit, activeFault) : null;
    inspector.textContent = fault
      ? `Injected training fault: ${fault.label}. The circuit definition itself was not mutated.`
      : "No training fault is injected.";
    render();
  });

  render();
})();
