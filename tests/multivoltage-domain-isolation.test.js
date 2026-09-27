"use strict";

const fs = require("fs");
const path = require("path");
const comparisons = require("../src/engineering/comparisons");
const measurements = require("../src/engineering/measurements");
const specifications = require("../src/engineering/specifications");

const root = path.join(__dirname, "..");
const circuit = JSON.parse(fs.readFileSync(
  path.join(root, "data", "circuit-templates", "electrified-multivoltage.json"),
  "utf8"
));
const chargingCatalog = JSON.parse(fs.readFileSync(
  path.join(root, "data", "engineering", "authoritative-specifications", "delco-remy-starting-charging.json"),
  "utf8"
));

function calculatedVoltage(value, voltageSystemId) {
  return {
    quantityType: "voltage",
    unit: "V",
    valueRole: "calculated_value",
    value,
    calculation: {
      formula: "declared training-domain value",
      inputs: [voltageSystemId]
    },
    electricalDomain: {
      voltageSystemId
    }
  };
}

describe("multi-voltage engineering domain isolation", () => {
  test("keeps declared LV12 and TR400 domains distinct", () => {
    expect(circuit.voltageSystems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "LV12", nominalVoltage: 12 }),
      expect.objectContaining({ id: "TR400", nominalVoltage: 400 })
    ]));
  });

  test("allows same-domain numeric comparison", () => {
    const result = comparisons.compareQuantities(
      calculatedVoltage(12, "LV12"),
      calculatedVoltage(11.5, "LV12"),
      { basisRole: "generic_training_example" }
    );
    expect(result.status).toBe("changed");
    expect(result.comparable).toBe(true);
    expect(result.delta).toBeCloseTo(-0.5, 9);
  });

  test("rejects cross-domain numeric comparison even when units match", () => {
    const result = comparisons.compareQuantities(
      calculatedVoltage(12, "LV12"),
      calculatedVoltage(400, "TR400"),
      { basisRole: "generic_training_example" }
    );
    expect(result.status).toBe("not_comparable");
    expect(result.comparable).toBe(false);
    expect(result.errors).toContain("electrical voltage domain must match");
  });

  test("preserves measurement voltage-domain metadata", () => {
    const measured = measurements.createMeasuredQuantity({
      quantityType: "voltage_drop",
      unit: "V",
      value: 0.15,
      labId: "multivoltage-domain-test",
      measurementId: "lv12-drop",
      entryMethod: "instructor_entry",
      voltageSystemId: "LV12",
      nominalVoltage: 12
    });

    expect(measured.measurement.context.voltageSystemId).toBe("LV12");
    expect(measured.measurement.context.nominalVoltage).toBe(12);
  });

  test("rejects a traction-domain measurement against a 12 V charging reference", () => {
    const reference = specifications.selectMostSpecificSpecification(chargingCatalog, {
      system: "charging",
      systemVoltage: 12,
      parameter: "charging_cable_voltage_drop"
    });
    expect(reference).not.toBeNull();
    expect(reference.applicability.systemVoltage).toBe(12);

    const tractionMeasured = measurements.createMeasuredQuantity({
      quantityType: "voltage_drop",
      unit: "V",
      value: 0.15,
      labId: "multivoltage-domain-test",
      measurementId: "traction-drop",
      entryMethod: "instructor_entry",
      voltageSystemId: "TR400",
      nominalVoltage: 400
    });

    const result = comparisons.compareMeasuredToReference(
      tractionMeasured,
      reference
    );

    expect(result.status).toBe("not_comparable");
    expect(result.comparable).toBe(false);
    expect(result.reason).toMatch(/voltage domain does not match/i);
  });

  test("allows a 12 V-domain measurement to reach the 12 V charging comparison path", () => {
    const reference = specifications.selectMostSpecificSpecification(chargingCatalog, {
      system: "charging",
      systemVoltage: 12,
      parameter: "charging_cable_voltage_drop"
    });
    expect(reference).not.toBeNull();

    const lvMeasured = measurements.createMeasuredQuantity({
      quantityType: "voltage_drop",
      unit: "V",
      value: 0.15,
      labId: "multivoltage-domain-test",
      measurementId: "lv12-reference-drop",
      entryMethod: "instructor_entry",
      voltageSystemId: "LV12",
      nominalVoltage: 12
    });

    const result = comparisons.compareMeasuredToReference(
      lvMeasured,
      reference
    );

    expect(["within_reference", "reference_only"]).toContain(result.status);
    expect(result.status).not.toBe("not_comparable");
  });

  test("rejects measured-to-expected delta across different voltage-system IDs", () => {
    const measured = measurements.createMeasuredQuantity({
      quantityType: "voltage",
      unit: "V",
      value: 12,
      labId: "multivoltage-domain-test",
      measurementId: "lv12-measured",
      entryMethod: "instructor_entry",
      voltageSystemId: "LV12",
      nominalVoltage: 12
    });

    const expected = calculatedVoltage(12, "TR400");

    expect(() => measurements.deltaBetween(measured, expected)).toThrow(
      "measurement and expected quantity must share electrical voltage domain"
    );
  });
});
