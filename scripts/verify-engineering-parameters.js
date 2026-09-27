"use strict";

const fs = require("fs");
const path = require("path");
const { validateEngineeringProfile } = require("../src/engineering/profiles");

const catalogPath = path.join(__dirname, "..", "data", "engineering", "training-examples.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8").replace(/^\uFEFF/, ""));

const errors = [];
if (catalog.catalogRole !== "generic-training-examples") {
  errors.push("training catalog must declare catalogRole generic-training-examples");
}
if (!Array.isArray(catalog.profiles) || catalog.profiles.length === 0) {
  errors.push("training catalog requires at least one profile");
}

const ids = new Set();
for (const entry of catalog.profiles || []) {
  if (!entry.id || ids.has(entry.id)) errors.push(`invalid or duplicate training profile id: ${entry.id}`);
  ids.add(entry.id);
  const profileErrors = validateEngineeringProfile(entry.engineeringProfile);
  errors.push(...profileErrors.map((error) => `${entry.id}: ${error}`));

  for (const [name, quantity] of Object.entries(entry.engineeringProfile?.parameters || {})) {
    if (quantity.valueRole !== "generic_training_example") {
      errors.push(`${entry.id}.${name} must remain generic_training_example in the training catalog`);
    }
  }
}

if (errors.length) {
  console.error("Engineering parameter validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`✓ Engineering parameter validation passed: ${catalog.profiles.length} generic training profiles`);
