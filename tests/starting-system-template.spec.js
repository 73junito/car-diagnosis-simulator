"use strict";

const fs = require("fs");
const path = require("path");
const engine = require("../src/circuits/engine");
const { validateCircuitTemplate } = require("../src/circuits/template-contracts");
const { SymbolRegistry } = require("../src/symbols/registry");
const { ConnectionStyleRegistry } = require("../src/connections");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

describe("12 V starting-system circuit template", () => {
  const root = path.resolve(__dirname, "..");
  const template = readJson(path.join(root, "data/circuit-templates/12v-starting-system.json"));
  const symbolManifest = readJson(path.join(root, "data/symbols/manifest.json"));
  const symbols = symbolManifest.domains.flatMap((domain) =>
    readJson(path.join(root, "data/symbols", domain.file)).symbols
  );
  const connectionCatalog = readJson(path.join(root, "data/connections/electrical.json"));
  const symbolRegistry = new SymbolRegistry().registerMany(symbols);
  const connectionRegistry = new ConnectionStyleRegistry(connectionCatalog.styles);

  test("template satisfies reusable circuit, symbol, terminal, and connection contracts", () => {
    expect(validateCircuitTemplate(template, engine, symbolRegistry, connectionRegistry)).toEqual({
      valid: true,
      errors: []
    });
    expect(template.templateId).toBe("automotive-12v-starting-system");
    expect(template.voltageSystems[0].nominalVoltage).toBe(12);
    expect(template.components).toHaveLength(7);
    expect(template.connections).toHaveLength(8);
    expect(template.faultCatalog).toHaveLength(4);
  });

  test("open faults remove their targeted conductor from the adjacency graph", () => {
    const normal = engine.buildAdjacency(template);
    expect(normal.get("SW1_OUT").some((edge) => edge.edge.id === "W_SWITCH_SOL")).toBe(true);
    expect(normal.get("SOL_CONTACT_MOTOR").some((edge) => edge.edge.id === "W_CONTACT_MOTOR")).toBe(true);

    const openControl = engine.buildAdjacency(template, ["FAULT_OPEN_CONTROL"]);
    expect(openControl.get("SW1_OUT").some((edge) => edge.edge.id === "W_SWITCH_SOL")).toBe(false);

    const openPower = engine.buildAdjacency(template, ["FAULT_OPEN_POWER"]);
    expect(openPower.get("SOL_CONTACT_MOTOR").some((edge) => edge.edge.id === "W_CONTACT_MOTOR")).toBe(false);
  });

  test("high-resistance faults preserve continuity while marking the affected edge degraded", () => {
    const groundFault = engine.buildAdjacency(template, ["FAULT_HIGH_RES_GROUND"]);
    const groundEdge = groundFault.get("MTR1_GND").find((edge) => edge.edge.id === "W_MOTOR_GND");
    expect(groundEdge).toBeTruthy();
    expect(groundEdge.edge.degraded).toBe(true);

    const powerFault = engine.buildAdjacency(template, ["FAULT_HIGH_RES_POWER"]);
    const powerEdge = powerFault.get("SOL_CONTACT_MOTOR").find((edge) => edge.edge.id === "W_CONTACT_MOTOR");
    expect(powerEdge).toBeTruthy();
    expect(powerEdge.edge.degraded).toBe(true);
  });

  test("crank state declares distinct control, power, and ground flows", () => {
    const crank = template.operatingStates.find((state) => state.id === "crank");
    expect(crank.activeFlows.control.map(([id]) => id)).toContain("W_SWITCH_SOL");
    expect(crank.activeFlows.power.map(([id]) => id)).toEqual(expect.arrayContaining([
      "W_BAT_CONTACT", "W_CONTACT_MOTOR"
    ]));
    expect(crank.activeFlows.ground.map(([id]) => id)).toEqual(expect.arrayContaining([
      "W_SOL_COIL_GND", "W_MOTOR_GND", "W_BAT_GND"
    ]));
  });
});
