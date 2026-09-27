(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindEngineeringContracts;

const ENTRY_METHODS = Object.freeze(["student_entry", "instrument_entry", "instructor_entry"]);

function createMeasuredQuantity({
  quantityType,
  unit,
  value,
  labId,
  measurementId,
  entryMethod = "student_entry",
  testPointId = null,
  note = null
}) {
  const quantity = {
    quantityType,
    unit,
    valueRole: "measured_value",
    value,
    measurement: {
      entryMethod,
      context: {
        labId,
        measurementId
      }
    }
  };
  if (testPointId) quantity.measurement.context.testPointId = testPointId;
  if (note) quantity.measurement.note = note;

  const errors = contracts.validateEngineeringQuantity(quantity);
  if (errors.length) throw new Error(errors.join("; "));
  return quantity;
}

function compareMeasurementToReference(measured, reference) {
  const errors = [
    ...contracts.validateEngineeringQuantity(measured).map(error => `measured: ${error}`),
    ...contracts.validateEngineeringQuantity(reference?.quantity).map(error => `reference: ${error}`)
  ];
  if (errors.length) return { status: "invalid", errors };
  if (measured.quantityType !== reference.quantity.quantityType || measured.unit !== reference.quantity.unit) {
    return { status: "not_comparable", reason: "quantity type and unit must match" };
  }

  const measuredValue = measured.value;
  const referenceValue = reference.quantity.value;
  switch (reference.comparison) {
    case "maximum":
      return { status: measuredValue <= referenceValue ? "within_reference" : "exceeds_reference", difference: measuredValue - referenceValue };
    case "minimum":
      return { status: measuredValue >= referenceValue ? "within_reference" : "below_reference", difference: measuredValue - referenceValue };
    case "greater_than":
      return { status: measuredValue > referenceValue ? "within_reference" : "does_not_meet_reference", difference: measuredValue - referenceValue };
    case "less_than":
      return { status: measuredValue < referenceValue ? "within_reference" : "does_not_meet_reference", difference: measuredValue - referenceValue };
    case "design_basis":
      return { status: "reference_only", difference: measuredValue - referenceValue };
    default:
      return { status: "not_comparable", reason: "reference comparison is not supported for pass/fail interpretation" };
  }
}

function deltaBetween(measured, expected) {
  const measuredErrors = contracts.validateEngineeringQuantity(measured);
  const expectedErrors = contracts.validateEngineeringQuantity(expected);
  if (measuredErrors.length || expectedErrors.length) throw new Error([...measuredErrors, ...expectedErrors].join("; "));
  if (measured.quantityType !== expected.quantityType || measured.unit !== expected.unit) {
    throw new Error("measurement and expected quantity must share quantity type and unit");
  }
  return measured.value - expected.value;
}

const api = {
  ENTRY_METHODS,
  createMeasuredQuantity,
  compareMeasurementToReference,
  deltaBetween
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringMeasurements = api;
})();