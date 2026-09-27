"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { validateArtifact } = require("../../scripts/verify-engineering-artifacts");
const { parseScalar } = require("./run-relay-load-model");

const root = path.join(__dirname, "..", "..");
const netlistPath = path.join(__dirname, "starting-cable-voltage-drop.cir");
const schemaPath = path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function ngspiceVersion() {
  const result = spawnSync("ngspice", ["--version"], { encoding: "utf8" });
  if (result.error) throw new Error("ngspice is required: " + result.error.message);
  const text = (result.stdout || "") + " " + (result.stderr || "");
  const match = text.match(/ngspice[-\s]+(\d+(?:\.\d+)?)/i);
  return match ? match[1] : "unknown";
}

function makeArtifact({ artifactId, modelId, observed, label, version }) {
  return {
    schemaVersion: "1.0.0",
    artifactId,
    modelId,
    evidenceRole: "project_authored_training_model",
    generator: { tool: "ngspice", version },
    domain: {
      system: "starting-cable-voltage-drop",
      voltageClass: "12V-source-applicable-training-example",
      applicability: "project-authored cable-resistance model evaluated at the selected 500 A source-backed test current"
    },
    quantity: { quantityType: "voltage_drop", unit: "V" },
    baseline: { value: 0, label: "ideal zero-drop conductor model" },
    observed: { value: Number(observed.toFixed(3)), label },
    comparison: {
      status: "changed",
      delta: Number(observed.toFixed(3)),
      interpretation: "numeric_delta_only",
      authoritativeSpecification: false,
      reason: "ngspice project-authored cable-resistance model output; authoritative interpretation must be performed separately against an applicable source record."
    },
    provenance: {
      method: "ngspice DC operating-point model at the selected 500 A source-backed test current",
      sourceType: "project_model",
      reproducible: true,
      sourceId: "delco-remy-diagnostic-procedures-manual"
    }
  };
}

function compareToPython(spiceArtifact, pythonArtifact, tolerance = 0.001) {
  const observedDifference = Math.abs(spiceArtifact.observed.value - pythonArtifact.observed.value);
  if (observedDifference > tolerance) {
    throw new Error(
      "ngspice/Python starting voltage-drop mismatch: " +
      observedDifference + " V exceeds " + tolerance + " V tolerance"
    );
  }
}

function run() {
  const result = spawnSync("ngspice", ["-b", netlistPath], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });

  if (result.error) throw new Error("ngspice execution failed: " + result.error.message);
  const output = (result.stdout || "") + "\n" + (result.stderr || "");
  if (result.status !== 0) throw new Error("ngspice exited with " + result.status + ":\n" + output);

  const withinValue = parseScalar(output, "tm_start_within");
  const exceedsValue = parseScalar(output, "tm_start_exceeds");
  const version = ngspiceVersion();

  const withinArtifact = makeArtifact({
    artifactId: "starting-cable-drop-within-candidate-ngspice-v1",
    modelId: "starting-cable-drop-0p35-training-model-ngspice",
    observed: withinValue,
    label: "modeled total cable drop SPICE result",
    version
  });

  const exceedsArtifact = makeArtifact({
    artifactId: "starting-cable-drop-exceeds-candidate-ngspice-v1",
    modelId: "starting-cable-drop-0p45-training-model-ngspice",
    observed: exceedsValue,
    label: "modeled total cable drop SPICE result",
    version
  });

  const schema = readJson("data/engineering/schemas/engineering-model-artifact.schema.json");
  for (const artifact of [withinArtifact, exceedsArtifact]) {
    const errors = validateArtifact(artifact, schema);
    if (errors.length) {
      throw new Error("Generated ngspice starting artifact is invalid:\n- " + errors.join("\n- "));
    }
  }

  const pythonWithin = readJson("data/engineering/generated/starting-cable-drop-within-candidate.json");
  const pythonExceeds = readJson("data/engineering/generated/starting-cable-drop-exceeds-candidate.json");
  compareToPython(withinArtifact, pythonWithin);
  compareToPython(exceedsArtifact, pythonExceeds);

  fs.writeFileSync(
    path.join(root, "data", "engineering", "generated", "starting-cable-drop-within-candidate-ngspice.json"),
    JSON.stringify(withinArtifact, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(root, "data", "engineering", "generated", "starting-cable-drop-exceeds-candidate-ngspice.json"),
    JSON.stringify(exceedsArtifact, null, 2) + "\n"
  );

  console.log(
    "✓ ngspice starting cable-drop artifacts cross-validated: " +
    withinArtifact.observed.value.toFixed(3) + " V and " +
    exceedsArtifact.observed.value.toFixed(3) + " V"
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { makeArtifact, compareToPython, run };
