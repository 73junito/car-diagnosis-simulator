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

describe("12 V relay-controlled load template", () => {
  const root = path.resolve(__dirname, "..");
  const template = readJson(path.join(root, "data/circuit-templates/12v-relay-controlled-load.json"));
  const manifest = readJson(path.join(root, "data/symbols/manifest.json"));
  const symbols = manifest.domains.flatMap((domain) =>
    readJson(path.join(root, "data/symbols", domain.file)).symbols
  );
  const connections = readJson(path.join(root, "data/connections/electrical.json"));
  const symbolRegistry = new SymbolRegistry().registerMany(symbols);
  const connectionRegistry = new ConnectionStyleRegistry(connections.styles);

  test("satisfies reusable template and library contracts", () => {
    expect(validateCircuitTemplate(template, engine, symbolRegistry, connectionRegistry)).toEqual({ valid:true, errors:[] });
    expect(template.voltageSystems[0].nominalVoltage).toBe(12);
    expect(template.components).toHaveLength(8);
    expect(template.connections).toHaveLength(9);
    expect(template.testPoints).toHaveLength(5);
    expect(template.faultCatalog).toHaveLength(5);
  });

  test("command-on declares separate control and load branches", () => {
    const state = template.operatingStates.find((item) => item.id === "command-on");
    expect(state.activeFlows.control.map(([id]) => id)).toEqual(["W_SWITCH_COIL"]);
    expect(state.activeFlows.power.map(([id]) => id)).toEqual(expect.arrayContaining([
      "W_BAT_CTRL_FUSE", "W_CTRL_FUSE_SWITCH", "W_BAT_LOAD_FUSE",
      "W_LOAD_FUSE_CONTACT", "W_CONTACT_LOAD"
    ]));
    expect(state.activeFlows.ground.map(([id]) => id)).toEqual(expect.arrayContaining([
      "W_COIL_GND", "W_LOAD_GND", "W_BAT_GND"
    ]));
  });

  test("open control and open load faults remove only their targeted conductors", () => {
    const controlFault = engine.buildAdjacency(template, ["FAULT_OPEN_CONTROL_FEED"]);
    expect(controlFault.get("SW1_OUT").some((edge) => edge.edge.id === "W_SWITCH_COIL")).toBe(false);
    expect(controlFault.get("RELAY_CONTACT_OUT").some((edge) => edge.edge.id === "W_CONTACT_LOAD")).toBe(true);

    const loadFault = engine.buildAdjacency(template, ["FAULT_OPEN_RELAY_OUTPUT"]);
    expect(loadFault.get("RELAY_CONTACT_OUT").some((edge) => edge.edge.id === "W_CONTACT_LOAD")).toBe(false);
    expect(loadFault.get("SW1_OUT").some((edge) => edge.edge.id === "W_SWITCH_COIL")).toBe(true);
  });

  test("high resistance preserves continuity but marks the affected branch degraded", () => {
    const power = engine.buildAdjacency(template, ["FAULT_HIGH_RES_LOAD_POWER"]);
    expect(power.get("RELAY_CONTACT_OUT").find((edge) => edge.edge.id === "W_CONTACT_LOAD").edge.degraded).toBe(true);
    const ground = engine.buildAdjacency(template, ["FAULT_HIGH_RES_LOAD_GROUND"]);
    expect(ground.get("LOAD1_GND").find((edge) => edge.edge.id === "W_LOAD_GND").edge.degraded).toBe(true);
  });
});
