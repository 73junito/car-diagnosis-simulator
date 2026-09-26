"use strict";

const fs = require("fs");
const path = require("path");
const engine = require("../src/circuits/engine");

const circuit = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/circuits/generic-charging-system.json"), "utf8")
);

describe("deterministic circuit engine", () => {
  test("generic charging circuit validates", () => {
    expect(engine.validateCircuit(circuit)).toEqual({ valid: true, errors: [] });
  });

  test("battery-to-alternator power path exists without a fault", () => {
    const result = engine.tracePath(circuit, "BAT1_POS", "ALT1_BPLUS");
    expect(result.found).toBe(true);
    expect(result.connections).toEqual(["W_BAT_FUSE", "W_FUSE_ALT"]);
    expect(result.degraded).toBe(false);
  });

  test("open-circuit overlay blocks charging path without mutating circuit", () => {
    const original = JSON.stringify(circuit);
    const result = engine.tracePath(circuit, "BAT1_POS", "ALT1_BPLUS", { faults: ["FAULT_OPEN_CHARGE_FEED"] });
    expect(result.found).toBe(false);
    expect(JSON.stringify(circuit)).toBe(original);
  });

  test("high-resistance overlay preserves topology but marks path degraded", () => {
    const result = engine.tracePath(circuit, "ALT1_GND", "GND1_MAIN", { faults: ["FAULT_HIGH_RES_GROUND"] });
    expect(result.found).toBe(true);
    expect(result.connections).toEqual(["W_ALT_GND"]);
    expect(result.degraded).toBe(true);
  });

  test("component inspection is derived from graph state", () => {
    expect(engine.getConnectedComponents(circuit, "FUSE1").sort()).toEqual(["ALT1", "BAT1", "LOAD1"]);
  });

  test("test points never provide invented vehicle-specific values", () => {
    const points = engine.getAvailableTestPoints(circuit, "ALT1");
    expect(points).toHaveLength(1);
    expect(points[0].vehicleSpecificValueRequired).toBe(true);
    expect(points[0]).not.toHaveProperty("expectedVoltage");
    expect(points[0]).not.toHaveProperty("expectedValue");
  });

  test("training model is explicitly non-vehicle-specific and non-scored", () => {
    expect(circuit.vehicleApplicability.vehicleSpecific).toBe(false);
    expect(circuit.curriculum.assessmentUse).toBe("training-only");
    expect(circuit.provenance.scoredAssessmentApproved).toBe(false);
  });
});
