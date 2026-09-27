(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindEngineeringContracts;

const COMPARISONS = Object.freeze([
  "exact",
  "maximum",
  "minimum",
  "greater_than",
  "less_than",
  "design_basis"
]);

function validateApplicability(applicability) {
  const errors = [];
  if (!applicability || typeof applicability !== "object" || Array.isArray(applicability)) {
    return ["authoritative specification requires applicability object"];
  }
  if (!applicability.system || typeof applicability.system !== "string") {
    errors.push("applicability.system is required");
  }
  if (applicability.systemVoltage !== undefined &&
      (!Number.isFinite(applicability.systemVoltage) || applicability.systemVoltage <= 0)) {
    errors.push("applicability.systemVoltage must be a positive finite number when provided");
  }
  if (applicability.starterFamilies !== undefined &&
      (!Array.isArray(applicability.starterFamilies) || applicability.starterFamilies.length === 0)) {
    errors.push("applicability.starterFamilies must be a non-empty array when provided");
  }
  if (applicability.testMethod !== undefined &&
      (typeof applicability.testMethod !== "string" || !applicability.testMethod.trim())) {
    errors.push("applicability.testMethod must be a non-empty string when provided");
  }
  return errors;
}

function validateAuthoritativeSpecification(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") return ["authoritative specification must be an object"];
  if (!entry.id || typeof entry.id !== "string") errors.push("authoritative specification requires id");
  if (!entry.parameter || typeof entry.parameter !== "string") errors.push("authoritative specification requires parameter");
  if (!COMPARISONS.includes(entry.comparison)) errors.push("authoritative specification has unsupported comparison");

  const quantityErrors = contracts.validateEngineeringQuantity(entry.quantity);
  errors.push(...quantityErrors.map(error => `quantity: ${error}`));
  if (entry.quantity?.valueRole !== "authoritative_specification") {
    errors.push("quantity.valueRole must be authoritative_specification");
  }

  errors.push(...validateApplicability(entry.applicability));

  if (!entry.notes || typeof entry.notes !== "string") {
    errors.push("authoritative specification requires project-authored notes");
  }

  return errors;
}

function findApplicableSpecifications(catalog, filters = {}) {
  const entries = Array.isArray(catalog?.specifications) ? catalog.specifications : [];
  return entries.filter(entry => {
    const app = entry.applicability || {};
    if (filters.system && app.system !== filters.system) return false;
    if (filters.systemVoltage !== undefined &&
        app.systemVoltage !== undefined &&
        app.systemVoltage !== filters.systemVoltage) return false;
    if (filters.starterFamily &&
        Array.isArray(app.starterFamilies) &&
        !app.starterFamilies.includes(filters.starterFamily)) return false;
    if (filters.testMethod && app.testMethod && app.testMethod !== filters.testMethod) return false;
    if (filters.parameter && entry.parameter !== filters.parameter) return false;
    return true;
  });
}

function specificityScore(entry) {
  const app = entry?.applicability || {};
  let score = 0;
  if (app.systemVoltage !== undefined) score += 2;
  if (Array.isArray(app.starterFamilies) && app.starterFamilies.length) score += 4;
  if (app.wiringConfiguration) score += 2;
  if (app.conductor) score += 2;
  if (app.testMethod) score += 1;
  return score;
}

function selectMostSpecificSpecification(catalog, filters = {}) {
  const candidates = findApplicableSpecifications(catalog, filters);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => specificityScore(b) - specificityScore(a))[0];
}

function findProductProfile(catalog, filters = {}) {
  const profiles = Array.isArray(catalog?.productProfiles) ? catalog.productProfiles : [];
  return profiles.find(entry => {
    if (filters.partNumber && entry.partNumber !== filters.partNumber) return false;
    if (filters.groupSize && entry.groupSize !== filters.groupSize) return false;
    if (filters.systemVoltage !== undefined && entry.systemVoltage !== filters.systemVoltage) return false;
    return true;
  }) || null;
}

const api = {
  COMPARISONS,
  validateApplicability,
  validateAuthoritativeSpecification,
  findApplicableSpecifications,
  specificityScore,
  selectMostSpecificSpecification,
  findProductProfile
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringSpecifications = api;
})();