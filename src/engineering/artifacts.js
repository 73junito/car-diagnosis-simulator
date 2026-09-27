(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindEngineeringContracts;

const DEFAULT_REGISTRY_URL = "/data/engineering/browser-artifact-registry.json";
const GENERATED_PREFIX = "/data/engineering/generated/";

function validateRegistryEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") return ["artifact registry entry must be an object"];
  if (!entry.key || typeof entry.key !== "string") errors.push("artifact registry entry requires key");
  if (!entry.path || typeof entry.path !== "string" || !entry.path.startsWith(GENERATED_PREFIX) || !entry.path.endsWith(".json")) {
    errors.push("artifact registry path must reference generated engineering JSON");
  }
  if (!entry.expected || typeof entry.expected !== "object") errors.push("artifact registry entry requires expected contract");
  return errors;
}

function contextMatches(entry, context = {}) {
  const required = entry.context || {};
  return Object.entries(required).every(([key, value]) => context[key] === value);
}
function validateArtifactForEntry(artifact, entry) {
  const errors = validateRegistryEntry(entry);
  if (!artifact || typeof artifact !== "object") return [...errors, "engineering artifact must be an object"];
  const expected = entry.expected || {};
  if (expected.artifactId && artifact.artifactId !== expected.artifactId) errors.push("artifactId does not match registry");
  if (expected.evidenceRole && artifact.evidenceRole !== expected.evidenceRole) errors.push("evidenceRole does not match registry");
  if (expected.quantityType && artifact.quantity?.quantityType !== expected.quantityType) errors.push("quantityType does not match registry");
  if (expected.unit && artifact.quantity?.unit !== expected.unit) errors.push("unit does not match registry");
  if (expected.authoritativeSpecification !== undefined &&
      artifact.comparison?.authoritativeSpecification !== expected.authoritativeSpecification) {
    errors.push("authoritativeSpecification does not match registry");
  }
  if (expected.comparisonStatus && artifact.comparison?.status !== expected.comparisonStatus) {
    errors.push("comparison status does not match registry");
  }
  if (expected.interpretation && artifact.comparison?.interpretation !== expected.interpretation) {
    errors.push("comparison interpretation does not match registry");
  }
  if (expected.observedAvailable === true && !Number.isFinite(artifact.observed?.value)) {
    errors.push("registry requires a finite observed artifact value");
  }
  if (expected.observedAvailable === false && artifact.observed !== null) {
    errors.push("registry requires observed artifact value to remain unavailable");
  }
  return errors;
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response || !response.ok) throw new Error("Unable to load engineering artifact resource: " + url);
  return response.json();
}

async function loadRegistry(url = DEFAULT_REGISTRY_URL, fetchImpl = fetch) {
  const registry = await fetchJson(url, fetchImpl);
  if (!registry || registry.registryRole !== "browser-engineering-artifacts" || !Array.isArray(registry.entries)) {
    throw new Error("Invalid browser engineering artifact registry");
  }
  const errors = registry.entries.flatMap((entry) => validateRegistryEntry(entry).map((error) => entry.key + ": " + error));
  if (errors.length) throw new Error(errors.join("; "));
  return registry;
}

async function resolveArtifact(registry, key, context = {}, fetchImpl = fetch) {
  const entry = registry.entries.find((item) => item.key === key);
  if (!entry) return { status:"unavailable", reason:"Artifact registry key is not available." };
  if (!contextMatches(entry, context)) {
    return { status:"not_applicable", reason:"Artifact context does not match the current lab state.", entry };
  }
  const artifact = await fetchJson(entry.path, fetchImpl);
  const errors = validateArtifactForEntry(artifact, entry);
  if (errors.length) throw new Error(errors.join("; "));
  return { status:"ready", entry, artifact };
}

function quantityFromArtifact(artifact, field) {
  const source = artifact?.[field];
  if (source === null || source === undefined) return null;
  if (!["baseline", "observed"].includes(field)) throw new Error("Artifact quantity field must be baseline or observed");
  if (!Number.isFinite(source.value)) throw new Error("Artifact quantity requires finite value");
  return {
    quantityType: artifact.quantity.quantityType,
    unit: artifact.quantity.unit,
    valueRole: "generic_training_example",
    value: source.value,
    artifact: {
      artifactId: artifact.artifactId,
      modelId: artifact.modelId,
      field
    }
  };
}

function compareObservedToAuthoritativeReference(artifact, reference, options = {}) {
  if (!artifact || artifact.evidenceRole !== "project_authored_training_model" ||
      artifact.comparison?.authoritativeSpecification !== false) {
    throw new Error("Only non-authoritative project training artifacts may be compared through this scenario path");
  }
  if (options.applicable === false) {
    return { status:"not_comparable", comparable:false, basisRole:"authoritative_specification", scenarioRole:artifact.evidenceRole, reason:options.reason || "Reference applicability does not match this scenario." };
  }
  if (options.openCircuit === true || artifact.observed === null) {
    return {
      status:"not_comparable",
      comparable:false,
      basisRole:"authoritative_specification",
      scenarioRole:artifact.evidenceRole,
      reason:artifact.comparison?.reason || options.reason || "Modeled scenario is not numerically comparable."
    };
  }

  const scenario = quantityFromArtifact(artifact, "observed");
  const referenceErrors = contracts.validateEngineeringQuantity(reference?.quantity);
  if (referenceErrors.length) return { status:"invalid", comparable:false, errors:referenceErrors };
  if (reference.quantity.valueRole !== "authoritative_specification") {
    throw new Error("Scenario comparison requires an authoritative specification reference");
  }
  if (scenario.quantityType !== reference.quantity.quantityType || scenario.unit !== reference.quantity.unit) {
    return { status:"not_comparable", comparable:false, reason:"quantity type and unit must match" };
  }
  if (Number.isFinite(options.nominalVoltage) &&
      Number.isFinite(reference?.applicability?.systemVoltage) &&
      options.nominalVoltage !== reference.applicability.systemVoltage) {
    return { status:"not_comparable", comparable:false, reason:"scenario voltage domain does not match source reference system voltage" };
  }

  const difference = scenario.value - reference.quantity.value;
  let status;
  switch (reference.comparison) {
    case "maximum":
      status = scenario.value <= reference.quantity.value ? "within_reference" : "exceeds_reference";
      break;
    case "minimum":
      status = scenario.value >= reference.quantity.value ? "within_reference" : "below_reference";
      break;
    case "greater_than":
      status = scenario.value > reference.quantity.value ? "within_reference" : "does_not_meet_reference";
      break;
    case "less_than":
      status = scenario.value < reference.quantity.value ? "within_reference" : "does_not_meet_reference";
      break;
    case "design_basis":
      status = "reference_only";
      break;
    default:
      return { status:"not_comparable", comparable:false, reason:"reference comparison is not supported for scenario interpretation" };
  }

  return {
    status,
    comparable:true,
    difference,
    observedValue:scenario.value,
    referenceValue:reference.quantity.value,
    basisRole:"authoritative_specification",
    scenarioRole:artifact.evidenceRole,
    artifactId:artifact.artifactId
  };
}

const api = {
  DEFAULT_REGISTRY_URL,
  validateRegistryEntry,
  validateArtifactForEntry,
  contextMatches,
  loadRegistry,
  resolveArtifact,
  quantityFromArtifact,
  compareObservedToAuthoritativeReference
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringArtifacts = api;
})();