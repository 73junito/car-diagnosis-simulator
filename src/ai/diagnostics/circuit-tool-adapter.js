"use strict";

const circuitEngine = require("../../circuits/engine");

function requireCircuit(context = {}) {
  if (!context.circuit || typeof context.circuit !== "object") {
    throw new Error("circuit context is required");
  }
  const validation = circuitEngine.validateCircuit(context.circuit);
  if (!validation.valid) {
    throw new Error("invalid circuit context: " + validation.errors.join("; "));
  }
  return context.circuit;
}

const CircuitToolAdapter = Object.freeze({
  id: "circuit-engine",
  sourceType: "deterministic-circuit",
  async execute(input = {}, context = {}) {
    const circuit = requireCircuit(context);
    const operation = input.operation;

    let normalizedData;
    if (operation === "trace-path") {
      normalizedData = circuitEngine.tracePath(
        circuit,
        input.startTerminalId,
        input.endTerminalId,
        { faults: Array.isArray(input.faults) ? input.faults : [] }
      );
    } else if (operation === "connected-components") {
      normalizedData = {
        componentId: input.componentId,
        connectedComponentIds: circuitEngine.getConnectedComponents(
          circuit,
          input.componentId,
          { faults: Array.isArray(input.faults) ? input.faults : [] }
        ),
      };
    } else if (operation === "test-points") {
      normalizedData = {
        componentId: input.componentId,
        testPoints: circuitEngine.getAvailableTestPoints(circuit, input.componentId),
      };
    } else {
      throw new Error("unsupported circuit-engine operation");
    }

    return {
      retrievedAt: context.retrievedAt || new Date().toISOString(),
      vehicleMatch: "generic",
      canonicalUrl: null,
      cacheStatus: "local",
      normalizedData,
    };
  },
});

module.exports = CircuitToolAdapter;
