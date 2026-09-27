"use strict";

const fs = require("fs");
const path = require("path");
const { validateEngineeringQuantity } = require("../src/engineering/contracts");
const { validateEngineeringProfile } = require("../src/engineering/profiles");
const { validateAuthoritativeSpecification } = require("../src/engineering/specifications");

const root = path.join(__dirname, "..");
const engineeringRoot = path.join(root, "data", "engineering");
const catalogPath = path.join(engineeringRoot, "training-examples.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));

const errors = [];
const sourceRegistries = [
  "external-technical-references.json",
  "document-technical-references.json"
].map(name => {
  const registryPath = path.join(root, "data", "evidence", name);
  return fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, "utf8").replace(/^\uFEFF/, ""))
    : { sources: [] };
});
const sourceById = new Map(sourceRegistries.flatMap(registry => registry.sources || []).map(source => [source.source_id, source]));

if (catalog.catalogRole !== "generic-training-examples") {
  errors.push("training catalog must declare catalogRole generic-training-examples");
}
if (!Array.isArray(catalog.profiles) || catalog.profiles.length === 0) {
  errors.push("training catalog requires at least one profile");
}

function requireGenericExampleQuantities(owner, profile) {
  const profileErrors = validateEngineeringProfile(profile);
  errors.push(...profileErrors.map((error) => `${owner}: ${error}`));
  for (const [name, quantity] of Object.entries(profile?.parameters || {})) {
    if (quantity.valueRole !== "generic_training_example") {
      errors.push(`${owner}.${name} must remain generic_training_example`);
    }
  }
}

const ids = new Set();
for (const entry of catalog.profiles || []) {
  if (!entry.id || ids.has(entry.id)) errors.push(`invalid or duplicate training profile id: ${entry.id}`);
  ids.add(entry.id);
  requireGenericExampleQuantities(entry.id, entry.engineeringProfile);
}

const labsDir = path.join(engineeringRoot, "labs");
let labProfileCount = 0;
if (fs.existsSync(labsDir)) {
  for (const file of fs.readdirSync(labsDir).filter((name) => name.endsWith(".json"))) {
    const fullPath = path.join(labsDir, file);
    const lab = JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, ""));
    labProfileCount += 1;

    if (lab.profileRole !== "lab-engineering-training-profile") {
      errors.push(`${file}: profileRole must be lab-engineering-training-profile`);
    }
    if (!lab.profileId) errors.push(`${file}: profileId is required`);
    if (!lab.circuitTemplateId) errors.push(`${file}: circuitTemplateId is required`);

    const namedProfiles = Object.entries(lab)
      .filter(([name, entry]) => name.endsWith("Profile") && entry?.engineeringProfile);

    if (namedProfiles.length === 0 && !(lab.conductorProfiles || []).length) {
      errors.push(`${file}: at least one engineering profile is required`);
    }

    for (const [name, entry] of namedProfiles) {
      requireGenericExampleQuantities(`${file}.${name}`, entry.engineeringProfile);
    }

    for (const [index, entry] of (lab.conductorProfiles || []).entries()) {
      if (!entry.targetConnectionId) errors.push(`${file}.conductorProfiles[${index}] requires targetConnectionId`);
      requireGenericExampleQuantities(
        `${file}.conductorProfiles[${index}]`,
        entry.engineeringProfile
      );
    }

    for (const [index, entry] of (lab.stateEngineering || []).entries()) {
      if (!entry.stateId) errors.push(`${file}.stateEngineering[${index}] requires stateId`);
      for (const [name, quantity] of Object.entries(entry).filter(([name]) => name !== "stateId")) {
        const quantityErrors = validateEngineeringQuantity(quantity);
        errors.push(...quantityErrors.map((error) => `${file}.stateEngineering[${index}].${name}: ${error}`));
        if (quantity?.valueRole !== "generic_training_example") {
          errors.push(`${file}.stateEngineering[${index}].${name} must remain generic_training_example`);
        }
      }
    }

    for (const [index, entry] of (lab.faultEngineering || []).entries()) {
      if (!entry.faultId) errors.push(`${file}.faultEngineering[${index}] requires faultId`);
      if (!entry.targetConnectionId) errors.push(`${file}.faultEngineering[${index}] requires targetConnectionId`);
      const quantityErrors = validateEngineeringQuantity(entry.addedResistance);
      errors.push(...quantityErrors.map((error) => `${file}.faultEngineering[${index}]: ${error}`));
      if (entry.addedResistance?.valueRole !== "generic_training_example") {
        errors.push(`${file}.faultEngineering[${index}].addedResistance must remain generic_training_example`);
      }
    }
  }
}

const authoritativeDir = path.join(engineeringRoot, "authoritative-specifications");
let authoritativeCatalogCount = 0;
let authoritativeSpecificationCount = 0;
const authoritativeIds = new Set();

if (fs.existsSync(authoritativeDir)) {
  for (const file of fs.readdirSync(authoritativeDir).filter(name => name.endsWith(".json"))) {
    const fullPath = path.join(authoritativeDir, file);
    const authoritative = JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, ""));
    authoritativeCatalogCount += 1;

    if (authoritative.schemaVersion !== "1.0.0") errors.push(`${file}: schemaVersion must be 1.0.0`);
    if (!["authoritative-specifications","authoritative-product-profiles"].includes(authoritative.catalogRole)) {
      errors.push(`${file}: unsupported authoritative catalogRole`);
    }
    if (authoritative.rightsMode !== "citation-only-structured-facts") {
      errors.push(`${file}: rightsMode must be citation-only-structured-facts`);
    }

    const validateSource = (owner, quantity) => {
      const sourceId = quantity?.source?.id;
      const locator = quantity?.source?.locator;
      const source = sourceById.get(sourceId);
      if (!source) {
        errors.push(`${owner}: source ${sourceId || "(missing)"} is not registered as a technical reference`);
        return;
      }
      if (!["external-technical-reference","document-technical-reference"].includes(source.evidence_role) || source.citation_allowed !== true) {
        errors.push(`${owner}: source ${sourceId} is not citation-eligible`);
      }
      if (source.evidence_role === "document-technical-reference" &&
          (source.ollama_eligible !== false || source.reusable_chunks_allowed !== false ||
           source.transcript_ingestion_allowed !== false || source.figures_reuse_allowed !== false)) {
        errors.push(`${owner}: document source ${sourceId} must remain citation-only and non-ingestible`);
      }
      if (!(source.references || []).some(reference => reference.locator === locator)) {
        errors.push(`${owner}: source locator is not registered for ${sourceId}`);
      }
    };

    if (authoritative.catalogRole === "authoritative-specifications") {
      if (!Array.isArray(authoritative.specifications) || authoritative.specifications.length === 0) {
        errors.push(`${file}: specifications must be a non-empty array`);
        continue;
      }
      for (const [index, entry] of authoritative.specifications.entries()) {
        authoritativeSpecificationCount += 1;
        const entryErrors = validateAuthoritativeSpecification(entry);
        errors.push(...entryErrors.map(error => `${file}.specifications[${index}]: ${error}`));
        if (entry.id && authoritativeIds.has(entry.id)) errors.push(`${file}: duplicate authoritative specification id ${entry.id}`);
        if (entry.id) authoritativeIds.add(entry.id);
        validateSource(`${file}.${entry.id || index}`, entry.quantity);
      }
    }

    if (authoritative.catalogRole === "authoritative-product-profiles") {
      if (!Array.isArray(authoritative.productProfiles) || authoritative.productProfiles.length === 0) {
        errors.push(`${file}: productProfiles must be a non-empty array`);
        continue;
      }
      for (const [index, entry] of authoritative.productProfiles.entries()) {
        const owner = `${file}.productProfiles[${index}]`;
        if (!entry.id || authoritativeIds.has(entry.id)) errors.push(`${owner}: product profile id missing or duplicate`);
        if (entry.id) authoritativeIds.add(entry.id);
        if (!entry.partNumber) errors.push(`${owner}: partNumber is required`);
        if (!Number.isFinite(entry.systemVoltage) || entry.systemVoltage <= 0) errors.push(`${owner}: systemVoltage must be positive`);
        const profileErrors = validateEngineeringProfile(entry.engineeringProfile);
        errors.push(...profileErrors.map(error => `${owner}: ${error}`));
        for (const quantity of Object.values(entry.engineeringProfile?.parameters || {})) {
          authoritativeSpecificationCount += 1;
          if (quantity.valueRole !== "authoritative_specification") errors.push(`${owner}: all product quantities must be authoritative_specification`);
          validateSource(owner, quantity);
        }
      }
    }
  }
}

if (errors.length) {
  console.error("Engineering parameter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `✓ Engineering parameter validation passed: ${catalog.profiles.length} generic training profiles, ${labProfileCount} lab training profiles, ${authoritativeSpecificationCount} authoritative specifications across ${authoritativeCatalogCount} catalogs`
);
