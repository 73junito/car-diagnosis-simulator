"use strict";

const fs = require("fs");
const path = require("path");
const { ConnectionStyleRegistry } = require("../src/connections");
const { validateConnectionStyle } = require("../src/connections/contracts");
const voltageDomains = require("../src/circuits/voltage-domains");
const engine = require("../src/circuits/engine");

const connectionCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/connections/electrical.json"), "utf8")
);
const circuit = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/circuits/generic-charging-system.json"), "utf8")
);

describe("connection styles and voltage domains", () => {
  test("electrical connection catalog contains the standardized style set", () => {
    expect(connectionCatalog.styles).toHaveLength(11);
    for (const style of connectionCatalog.styles) expect(validateConnectionStyle(style)).toEqual([]);
    const registry = new ConnectionStyleRegistry(connectionCatalog.styles);
    expect(registry.get("electrical.power").semanticType).toBe("power_feed");
    expect(registry.get("electrical.can-bus").semanticType).toBe("CAN");
    expect(registry.get("electrical.traction-power").strokeRole).toBe("traction");
  });

  test("current charging circuit resolves every declared connection style", () => {
    const registry = new ConnectionStyleRegistry(connectionCatalog.styles);
    expect(engine.validateCircuit(circuit)).toEqual({ valid: true, errors: [] });
    for (const connection of circuit.connections) {
      expect(registry.get(connection.styleId)).not.toBeNull();
      expect(connection.voltageSystemId).toBe("LV12");
    }
  });

  test("voltage-domain rules distinguish 12, 24, 48 and traction systems", () => {
    expect(voltageDomains.classifyVoltageDomain({ systemType:"low-voltage", nominalVoltage:12 })).toBe("lv-12");
    expect(voltageDomains.classifyVoltageDomain({ systemType:"low-voltage", nominalVoltage:24 })).toBe("lv-24");
    expect(voltageDomains.classifyVoltageDomain({ systemType:"low-voltage", nominalVoltage:48 })).toBe("lv-48");
    expect(voltageDomains.classifyVoltageDomain({ systemType:"traction", nominalVoltage:400 })).toBe("traction");
  });

  test("electrified architecture preserves every explicitly declared voltage", () => {
    const architecture = voltageDomains.describeVoltageArchitecture({
      powertrainType: "battery-electric",
      voltageSystems: [
        { id:"LV12", systemType:"low-voltage", nominalVoltage:12, displayLabel:"12 V nominal" },
        { id:"HV", systemType:"traction", nominalVoltage:800, displayLabel:"800 V nominal" }
      ]
    });
    expect(architecture.map((item) => item.label)).toEqual(["12 V nominal", "800 V nominal"]);
    expect(architecture.map((item) => item.domainClass)).toEqual(["lv-12", "traction"]);
  });
});
