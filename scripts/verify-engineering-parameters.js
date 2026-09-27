"use strict";

const fs = require("fs");
const path = require("path");
const { validateEngineeringQuantity } = require("../src/engineering/contracts");
const { validateEngineeringProfile } = require("../src/engineering/profiles");

const engineeringRoot = path.join(__dirname, "..", "data", "engineering");
const catalogPath = path.join(engineeringRoot, "training-examples.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));

const errors = [];
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

    if (lab.loadProfile?.engineeringProfile) {
      requireGenericExampleQuantities(`${file}.loadProfile`, lab.loadProfile.engineeringProfile);
    } else {
      errors.push(`${file}: loadProfile.engineeringProfile is required`);
    }

    for (const [index, entry] of (lab.conductorProfiles || []).entries()) {
      if (!entry.targetConnectionId) errors.push(`${file}.conductorProfiles[${index}] requires targetConnectionId`);
      requireGenericExampleQuantities(
        `${file}.conductorProfiles[${index}]`,
        entry.engineeringProfile
      );
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

if (errors.length) {
  console.error("Engineering parameter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `✓ Engineering parameter validation passed: ${catalog.profiles.length} generic training profiles, ${labProfileCount} lab training profiles`
);
