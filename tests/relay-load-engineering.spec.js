"use strict";

const fs = require("fs");
const path = require("path");
const calculator = require("../src/engineering/calculator");
const { validateEngineeringQuantity } = require("../src/engineering/contracts");
const { validateEngineeringProfile } = require("../src/engineering/profiles");

const root = path.resolve(__dirname, "..");
const circuit = JSON.parse(fs.readFileSync(
  path.join(root, "data/circuit-templates/12v-relay-controlled-load.json"), "utf8"
));
const profile = JSON.parse(fs.readFileSync(
  path.join(root, "data/engineering/labs/relay-load-training.json"), "utf8"
));

function conductorResistance(entry) {
  const p = entry.engineeringProfile.parameters;
  return calculator.calculateConductorResistance({
    resistivityOhmMeter:p.resistivity.value,
    length:p.length.value,
    lengthUnit:p.length.unit,
    area:p.area.value,
    areaUnit:p.area.unit
  }).value;
}

function calculate(additionalResistance=0) {
  const sourceVoltage = circuit.voltageSystems.find((system) => system.id === "LV12").nominalVoltage;
  const loadResistance = profile.loadProfile.engineeringProfile.parameters.resistance.value;
  const basePathResistance = profile.conductorProfiles.reduce(
    (sum, entry) => sum + conductorResistance(entry), 0
  );
  const pathResistance = basePathResistance + additionalResistance;
  const current = calculator.solveOhmsLaw({
    voltage:sourceVoltage,
    resistance:loadResistance + pathResistance
  });
  const voltageDrop = calculator.calculateVoltageDrop({
    current:current.value,
    resistance:pathResistance
  });
  const loadVoltage = calculator.calculateLoadVoltage({
    sourceVoltage,
    voltageDrop:voltageDrop.value
  });
  const loadPower = calculator.calculatePower({
    voltage:loadVoltage.value,
    current:current.value
  });
  const conductorLoss = calculator.calculatePowerLoss({
    current:current.value,
    resistance:pathResistance
  });
  return { basePathResistance, pathResistance, current, voltageDrop, loadVoltage, loadPower, conductorLoss };
}

describe("relay-load engineering training integration", () => {
  test("lab profile is explicitly generic training data", () => {
    expect(profile.profileRole).toBe("lab-engineering-training-profile");
    expect(profile.circuitTemplateId).toBe("automotive-12v-relay-controlled-load");
    expect(validateEngineeringProfile(profile.loadProfile.engineeringProfile)).toEqual([]);

    for (const entry of profile.conductorProfiles) {
      expect(validateEngineeringProfile(entry.engineeringProfile)).toEqual([]);
      for (const quantity of Object.values(entry.engineeringProfile.parameters)) {
        expect(quantity.valueRole).toBe("generic_training_example");
      }
    }

    for (const entry of profile.faultEngineering) {
      expect(validateEngineeringQuantity(entry.addedResistance)).toEqual([]);
      expect(entry.addedResistance.valueRole).toBe("generic_training_example");
    }
  });

  test("healthy training example calculates the full power and ground conductor path", () => {
    const result = calculate();
    expect(result.basePathResistance).toBeCloseTo(0.0344, 8);
    expect(result.current.value).toBeCloseTo(1.9885987008, 8);
    expect(result.voltageDrop.value).toBeCloseTo(0.0684077953, 8);
    expect(result.loadVoltage.value).toBeCloseTo(11.9315922047, 8);
    expect(result.loadPower.value).toBeCloseTo(23.7271487565, 8);
    expect(result.conductorLoss.value).toBeCloseTo(0.1360356529, 8);
    expect(result.current.valueRole).toBe("calculated_value");
    expect(result.current.calculation.formula).toBe("I = V / R");
  });

  test("high-resistance fault recalculates current, drop, load voltage, and power", () => {
    const added = profile.faultEngineering.find(
      (entry) => entry.faultId === "FAULT_HIGH_RES_LOAD_POWER"
    ).addedResistance.value;
    const result = calculate(added);

    expect(added).toBe(1.5);
    expect(result.pathResistance).toBeCloseTo(1.5344, 8);
    expect(result.current.value).toBeCloseTo(1.5926948397, 8);
    expect(result.voltageDrop.value).toBeCloseTo(2.4438309620, 8);
    expect(result.loadVoltage.value).toBeCloseTo(9.5561690380, 8);
    expect(result.loadPower.value).toBeCloseTo(15.2200611138, 8);
    expect(result.conductorLoss.value).toBeCloseTo(3.8922769622, 8);
  });

  test("both high-resistance faults use the same explicit example increment", () => {
    expect(profile.faultEngineering.map((entry) => [entry.faultId, entry.addedResistance.value])).toEqual([
      ["FAULT_HIGH_RES_LOAD_POWER", 1.5],
      ["FAULT_HIGH_RES_LOAD_GROUND", 1.5]
    ]);
  });
});
