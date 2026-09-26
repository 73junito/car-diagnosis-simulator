"use strict";

(function circuitEngineFactory(globalScope) {
  const contracts = typeof require === "function"
    ? require("./contracts")
    : globalScope.TorqueMindCircuitContracts;

  function validateCircuit(circuit) {
    const errors = [];
    if (!circuit || typeof circuit !== "object") return { valid: false, errors: ["circuit must be an object"] };
    if (!circuit.circuitId) errors.push("circuitId is required");
    if (!contracts.POWERTRAIN_TYPES.includes(circuit.powertrainType)) errors.push(`unsupported or missing powertrainType: ${circuit.powertrainType}`);
    if (!Array.isArray(circuit.voltageSystems) || circuit.voltageSystems.length === 0) errors.push("voltageSystems must contain at least one declared voltage system");
    if (!Array.isArray(circuit.components)) errors.push("components must be an array");
    if (!Array.isArray(circuit.connections)) errors.push("connections must be an array");
    if (errors.length) return { valid: false, errors };

    const voltageSystemIds = new Set();
    for (const system of circuit.voltageSystems) {
      if (!system.id || voltageSystemIds.has(system.id)) errors.push(`invalid or duplicate voltage system id: ${system.id}`);
      voltageSystemIds.add(system.id);
      if (!contracts.VOLTAGE_SYSTEM_TYPES.includes(system.systemType)) errors.push(`unsupported voltage system type: ${system.systemType}`);
      if (!(Number.isFinite(system.nominalVoltage) && system.nominalVoltage > 0)) errors.push(`voltage system ${system.id} requires a positive nominalVoltage`);
      if (system.unit !== "V DC") errors.push(`voltage system ${system.id} unit must be V DC`);
      if (!system.displayLabel || typeof system.displayLabel !== "string") errors.push(`voltage system ${system.id} requires displayLabel`);
    }
    if (circuit.powertrainType === "conventional-12v" && !circuit.voltageSystems.some((system) => system.nominalVoltage === 12)) {
      errors.push("conventional-12v circuits must declare a 12 V nominal voltage system");
    }

    const componentIds = new Set();
    const terminalOwners = new Map();

    for (const component of circuit.components) {
      if (!component.id || componentIds.has(component.id)) errors.push(`invalid or duplicate component id: ${component.id}`);
      componentIds.add(component.id);
      if (!contracts.COMPONENT_TYPES.includes(component.type)) errors.push(`unsupported component type: ${component.type}`);
      if (!component.voltageSystemId || !voltageSystemIds.has(component.voltageSystemId)) errors.push(`component ${component.id} requires a valid voltageSystemId`);
      if (!Array.isArray(component.terminals) || component.terminals.length === 0) errors.push(`component ${component.id} requires terminals`);
      for (const terminal of component.terminals || []) {
        if (!terminal.id || terminalOwners.has(terminal.id)) errors.push(`invalid or duplicate terminal id: ${terminal.id}`);
        terminalOwners.set(terminal.id, component.id);
      }
    }

    const connectionIds = new Set();
    for (const connection of circuit.connections) {
      if (!connection.id || connectionIds.has(connection.id)) errors.push(`invalid or duplicate connection id: ${connection.id}`);
      connectionIds.add(connection.id);
      if (!terminalOwners.has(connection.from)) errors.push(`connection ${connection.id} has unknown from terminal ${connection.from}`);
      if (!terminalOwners.has(connection.to)) errors.push(`connection ${connection.id} has unknown to terminal ${connection.to}`);
      if (!contracts.CONNECTION_TYPES.includes(connection.type)) errors.push(`unsupported connection type: ${connection.type}`);
      if (!/^electrical\.[a-z0-9-]+$/.test(connection.styleId || "")) errors.push(`connection ${connection.id} requires a valid styleId`);
      if (!connection.voltageSystemId || !voltageSystemIds.has(connection.voltageSystemId)) errors.push(`connection ${connection.id} requires a valid voltageSystemId`);
    }

    for (const fault of circuit.faultCatalog || []) {
      if (!fault.id) errors.push("fault id is required");
      if (!contracts.FAULT_TYPES.includes(fault.type)) errors.push(`unsupported fault type: ${fault.type}`);
      if (!connectionIds.has(fault.targetConnectionId)) errors.push(`fault ${fault.id} references unknown targetConnectionId ${fault.targetConnectionId}`);
      if (fault.type === "short_to_ground" || fault.type === "short_to_power" || fault.type === "short_between_lines") {
        if (!terminalOwners.has(fault.targetTerminalId)) errors.push(`fault ${fault.id} requires a valid targetTerminalId`);
        if (!terminalOwners.has(fault.shortTargetTerminalId)) errors.push(`fault ${fault.id} requires a valid shortTargetTerminalId`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  function normalizeFaults(circuit, faultIdsOrObjects = []) {
    const catalog = new Map((circuit.faultCatalog || []).map((fault) => [fault.id, fault]));
    return faultIdsOrObjects.map((fault) => typeof fault === "string" ? catalog.get(fault) : fault).filter(Boolean);
  }

  function buildAdjacency(circuit, faultIdsOrObjects = []) {
    const validation = validateCircuit(circuit);
    if (!validation.valid) throw new Error(`Invalid circuit: ${validation.errors.join("; ")}`);
    const faults = normalizeFaults(circuit, faultIdsOrObjects);
    const openConnections = new Set(faults.filter((f) => f.type === "open_circuit").map((f) => f.targetConnectionId));
    const highResistance = new Set(faults.filter((f) => f.type === "high_resistance").map((f) => f.targetConnectionId));
    const adjacency = new Map();

    for (const connection of circuit.connections) {
      if (openConnections.has(connection.id)) continue;
      const edge = { ...connection, degraded: highResistance.has(connection.id), internal: false };
      if (!adjacency.has(connection.from)) adjacency.set(connection.from, []);
      if (!adjacency.has(connection.to)) adjacency.set(connection.to, []);
      adjacency.get(connection.from).push({ terminalId: connection.to, edge });
      adjacency.get(connection.to).push({ terminalId: connection.from, edge });
    }

    for (const component of circuit.components) {
      for (const pair of component.internalConnections || []) {
        const [from, to] = pair;
        const edge = { id: null, type: "internal", internal: true, degraded: false };
        if (!adjacency.has(from)) adjacency.set(from, []);
        if (!adjacency.has(to)) adjacency.set(to, []);
        adjacency.get(from).push({ terminalId: to, edge });
        adjacency.get(to).push({ terminalId: from, edge });
      }
    }

    for (const fault of faults.filter((item) => item.type === "short_to_ground" || item.type === "short_to_power" || item.type === "short_between_lines")) {
      const from = fault.targetTerminalId;
      const to = fault.shortTargetTerminalId;
      const edge = {
        id: `fault:${fault.id}`,
        type: fault.type,
        internal: false,
        degraded: false,
        fault: true,
        faultId: fault.id
      };
      if (!adjacency.has(from)) adjacency.set(from, []);
      if (!adjacency.has(to)) adjacency.set(to, []);
      adjacency.get(from).push({ terminalId: to, edge });
      adjacency.get(to).push({ terminalId: from, edge });
    }
    return adjacency;
  }

  function tracePath(circuit, startTerminalId, endTerminalId, options = {}) {
    const adjacency = buildAdjacency(circuit, options.faults || []);
    const queue = [{ terminalId: startTerminalId, terminals: [startTerminalId], connections: [], degraded: false }];
    const visited = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current.terminalId === endTerminalId) {
        return { found: true, terminals: current.terminals, connections: current.connections, degraded: current.degraded };
      }
      if (visited.has(current.terminalId)) continue;
      visited.add(current.terminalId);
      for (const next of adjacency.get(current.terminalId) || []) {
        if (visited.has(next.terminalId)) continue;
        queue.push({
          terminalId: next.terminalId,
          terminals: [...current.terminals, next.terminalId],
          connections: next.edge.internal ? current.connections : [...current.connections, next.edge.id],
          degraded: current.degraded || next.edge.degraded
        });
      }
    }
    return { found: false, terminals: [], connections: [], degraded: false };
  }

  function getComponentForTerminal(circuit, terminalId) {
    return circuit.components.find((component) => component.terminals.some((terminal) => terminal.id === terminalId)) || null;
  }

  function getConnectedComponents(circuit, componentId, options = {}) {
    const component = circuit.components.find((candidate) => candidate.id === componentId);
    if (!component) return [];
    const adjacency = buildAdjacency(circuit, options.faults || []);
    const ids = new Set();
    for (const terminal of component.terminals) {
      for (const neighbor of adjacency.get(terminal.id) || []) {
        const owner = getComponentForTerminal(circuit, neighbor.terminalId);
        if (owner && owner.id !== componentId) ids.add(owner.id);
      }
    }
    return [...ids];
  }

  function getAvailableTestPoints(circuit, componentId) {
    const component = circuit.components.find((candidate) => candidate.id === componentId);
    if (!component) return [];
    const terminals = new Set(component.terminals.map((terminal) => terminal.id));
    return (circuit.testPoints || []).filter((point) => terminals.has(point.terminalId));
  }

  function getFault(circuit, faultId) {
    return (circuit.faultCatalog || []).find((fault) => fault.id === faultId) || null;
  }

  const api = { validateCircuit, buildAdjacency, tracePath, getComponentForTerminal, getConnectedComponents, getAvailableTestPoints, getFault };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.TorqueMindCircuitEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
