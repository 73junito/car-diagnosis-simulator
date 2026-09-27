"use strict";

const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");

const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json");
const generatedDir = path.join(root, "data", "engineering", "generated");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function semanticErrors(artifact) {
  const errors = [];
  const trainingLike = ["project_authored_training_model", "model_prediction"].includes(artifact.evidenceRole);
  const authoritativeStatuses = new Set([
    "within_reference",
    "exceeds_reference",
    "below_reference",
    "does_not_meet_reference",
    "reference_only"
  ]);

  if (trainingLike && artifact.comparison.authoritativeSpecification !== false) {
    errors.push("training/model-prediction artifacts cannot declare authoritativeSpecification=true");
  }

  if (trainingLike && authoritativeStatuses.has(artifact.comparison.status)) {
    errors.push("training/model-prediction artifacts cannot use authoritative reference statuses");
  }

  if (artifact.evidenceRole === "project_authored_training_model" &&
      artifact.comparison.interpretation !== "numeric_delta_only" &&
      !["unavailable", "not_comparable"].includes(artifact.comparison.status)) {
    errors.push("project-authored training models must use numeric_delta_only when a numeric comparison exists");
  }

  if (artifact.comparison.status === "changed" || artifact.comparison.status === "unchanged") {
    if (!artifact.baseline || !artifact.observed) {
      errors.push("changed/unchanged comparisons require baseline and observed values");
    } else {
      const expected = artifact.observed.value - artifact.baseline.value;
      if (!Number.isFinite(artifact.comparison.delta) ||
          Math.abs(expected - artifact.comparison.delta) > 1e-9) {
        errors.push("comparison delta must equal observed.value - baseline.value");
      }
    }
  }

  if (artifact.comparison.status === "unavailable" && artifact.observed !== null) {
    errors.push("unavailable comparisons must use observed=null");
  }

  if (artifact.provenance.sourceType === "project_model" &&
      artifact.evidenceRole !== "project_authored_training_model") {
    errors.push("project_model provenance must use project_authored_training_model evidenceRole");
  }

  return errors;
}

function validateArtifact(artifact, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const validSchema = validate(artifact);
  const errors = [];
  if (!validSchema) {
    errors.push(...validate.errors.map(error => `${error.instancePath || "/"} ${error.message}`));
  }
  errors.push(...semanticErrors(artifact));
  return errors;
}

function main() {
  const schema = readJson(schemaPath);
  const files = fs.existsSync(generatedDir)
    ? fs.readdirSync(generatedDir).filter(name => name.endsWith(".json")).sort()
    : [];
  if (!files.length) {
    console.error("Engineering artifact validation failed: no generated JSON artifacts found");
    process.exit(1);
  }

  const failures = [];
  for (const file of files) {
    const artifact = readJson(path.join(generatedDir, file));
    const errors = validateArtifact(artifact, schema);
    failures.push(...errors.map(error => `${file}: ${error}`));
  }

  if (failures.length) {
    console.error("Engineering artifact validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`✓ Engineering artifact validation passed: ${files.length} artifact(s)`);
}

if (require.main === module) main();

module.exports = { semanticErrors, validateArtifact };
