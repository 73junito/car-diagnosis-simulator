(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindEngineeringContracts;
const measurements = typeof require === "function"
  ? require("./measurements")
  : window.TorqueMindEngineeringMeasurements;

const STATUSES = Object.freeze([
  "baseline",
  "changed",
  "unchanged",
  "unavailable",
  "not_comparable",
  "within_reference",
  "exceeds_reference",
  "below_reference",
  "does_not_meet_reference",
  "reference_only"
]);

function validateComparablePair(baseline, observed) {
  const errors = [
    ...contracts.validateEngineeringQuantity(baseline).map(error => `baseline: ${error}`),
    ...contracts.validateEngineeringQuantity(observed).map(error => `observed: ${error}`)
  ];
  if (errors.length) return { valid:false, errors };
  if (baseline.quantityType !== observed.quantityType || baseline.unit !== observed.unit) {
    return { valid:false, errors:["quantity type and unit must match"] };
  }
  const baselineDomain = baseline.electricalDomain?.voltageSystemId || null;
  const observedDomain = observed.electricalDomain?.voltageSystemId || null;
  if (baselineDomain && observedDomain && baselineDomain !== observedDomain) {
    return { valid:false, errors:["electrical voltage domain must match"] };
  }
  return { valid:true, errors:[] };
}

function compareQuantities(baseline, observed, options = {}) {
  if (!observed) {
    return {
      status:"unavailable",
      comparable:false,
      basisRole:options.basisRole || baseline?.valueRole || null,
      reason:options.reason || "Observed/fault value is unavailable or intentionally not inferred."
    };
  }
  const validation = validateComparablePair(baseline, observed);
  if (!validation.valid) {
    return { status:"not_comparable", comparable:false, errors:validation.errors };
  }
  const delta = observed.value - baseline.value;
  const changed = Math.abs(delta) > (options.epsilon ?? 1e-9);
  return {
    status: changed ? "changed" : "unchanged",
    comparable:true,
    delta,
    baselineValue:baseline.value,
    observedValue:observed.value,
    quantityType:baseline.quantityType,
    unit:baseline.unit,
    basisRole:options.basisRole || baseline.valueRole,
    interpretation:"numeric_delta_only"
  };
}

function compareMeasuredToReference(measured, reference, options = {}) {
  if (options.applicable === false) {
    return {
      status:"not_comparable",
      comparable:false,
      reason:options.reason || "Reference applicability does not match this condition."
    };
  }
  if (options.openCircuit === true) {
    return {
      status:"not_comparable",
      comparable:false,
      reason:options.reason || "Reference comparison is not applied to an open circuit."
    };
  }
  const result = measurements.compareMeasurementToReference(measured, reference);
  return {
    ...result,
    comparable:!["invalid","not_comparable"].includes(result.status),
    basisRole:"authoritative_specification"
  };
}

function baselineOnly({ basisRole, reason = "No fault comparison is active." } = {}) {
  return { status:"baseline", comparable:false, basisRole:basisRole || null, reason };
}

function unavailable({ basisRole, reason } = {}) {
  return {
    status:"unavailable",
    comparable:false,
    basisRole:basisRole || null,
    reason:reason || "Faulted value is intentionally not inferred."
  };
}

const api = {
  STATUSES,
  compareQuantities,
  compareMeasuredToReference,
  baselineOnly,
  unavailable
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringComparisons = api;
})();