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
const externalReferencePath = path.join(root, "data", "evidence", "external-technical-references.json");
const externalReferences = JSON.parse(fs.readFileSync(externalReferencePath, "utf8").replace(/^\uFEFF/, ""));
const externalById = new Map((externalReferences.sources || []).map(source => [source.source_id, source]));

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
    if (authoritative.catalogRole !== "authoritative-specifications") {
      errors.push(`${file}: catalogRole must be authoritative-specifications`);
    }
    if (authoritative.rightsMode !== "citation-only-structured-facts") {
      errors.push(`${file}: rightsMode must be citation-only-structured-facts`);
    }
    if (!Array.isArray(authoritative.specifications) || authoritative.specifications.length === 0) {
      errors.push(`${file}: specifications must be a non-empty array`);
      continue;
    }

    for (const [index, entry] of authoritative.specifications.entries()) {
      authoritativeSpecificationCount += 1;
      const entryErrors = validateAuthoritativeSpecification(entry);
      errors.push(...entryErrors.map(error => `${file}.specifications[${index}]: ${error}`));

      if (entry.id && authoritativeIds.has(entry.id)) {
        errors.push(`${file}: duplicate authoritative specification id ${entry.id}`);
      }
      if (entry.id) authoritativeIds.add(entry.id);

      const sourceId = entry.quantity?.source?.id;
      const locator = entry.quantity?.source?.locator;
      const source = externalById.get(sourceId);
      if (!source) {
        errors.push(`${file}.${entry.id || index}: source ${sourceId || "(missing)"} is not registered as an external technical reference`);
        continue;
      }
      if (source.evidence_role !== "external-technical-reference" || source.citation_allowed !== true) {
        errors.push(`${file}.${entry.id || index}: source ${sourceId} is not citation-eligible`);
      }
      const locatorRegistered = (source.references || []).some(reference => reference.locator === locator);
      if (!locatorRegistered) {
        errors.push(`${file}.${entry.id || index}: source locator is not registered for ${sourceId}`);
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
