"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { validateArtifact } = require("../../scripts/verify-engineering-artifacts");
const { parseScalar } = require("./run-relay-load-model");

const root = path.join(__dirname, "..", "..");
const netlistPath = path.join(__dirname, "sensor-signal-short-ground.cir");
const schemaPath = path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json");
const pythonArtifactPath = path.join(root, "data", "engineering", "generated", "sensor-signal-short-ground.json");
const outputPath = path.join(root, "data", "engineering", "generated", "sensor-signal-short-ground-ngspice.json");

function ngspiceVersion() {
  const result = spawnSync("ngspice", ["--version"], { encoding: "utf8" });
  if (result.error) throw new Error("ngspice is required: " + result.error.message);
  const text = (result.stdout || "") + " " + (result.stderr || "");
  const match = text.match(/ngspice[-\s]+(\d+(?:\.\d+)?)/i);
  return match ? match[1] : "unknown";
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

  const healthy = parseScalar(output, "tm_healthy_sensor");
  const fault = parseScalar(output, "tm_fault_sensor");
  const delta = fault - healthy;

  const artifact = {
    schemaVersion: "1.0.0",
    artifactId: "sensor-signal-short-ground-ngspice-v1",
    modelId: "sensor-linear-transfer-short-ground-training-model-ngspice",
    evidenceRole: "project_authored_training_model",
    generator: { tool: "ngspice", version: ngspiceVersion() },
    domain: {
      system: "low-voltage-three-wire-sensor",
      voltageClass: "5V-reference-training-example",
      applicability: "generic project-authored sensor training model only"
    },
    quantity: { quantityType: "voltage", unit: "V" },
    baseline: { value: Number(healthy.toFixed(3)), label: "healthy SPICE signal" },
    observed: { value: Number(fault.toFixed(3)), label: "signal short-to-ground SPICE model" },
    comparison: {
      status: Math.abs(delta) > 1e-9 ? "changed" : "unchanged",
      delta: Number(delta.toFixed(3)),
      interpretation: "numeric_delta_only",
      authoritativeSpecification: false,
      reason: "ngspice project-authored sensor training-model delta; not a vehicle specification."
    },
    provenance: {
      method: "ngspice DC operating-point simulation of project-authored sensor divider and idealized signal short-to-ground",
      sourceType: "project_model",
      reproducible: true
    }
  };

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const errors = validateArtifact(artifact, schema);
  if (errors.length) {
    throw new Error("Generated ngspice sensor artifact is invalid:\n- " + errors.join("\n- "));
  }

  const pythonArtifact = JSON.parse(fs.readFileSync(pythonArtifactPath, "utf8"));
  const tolerance = 0.001;

  for (const key of ["baseline", "observed"]) {
    const difference = Math.abs(artifact[key].value - pythonArtifact[key].value);
    if (difference > tolerance) {
      throw new Error(
        "ngspice/Python sensor " + key + " mismatch: " +
        difference + " V exceeds " + tolerance + " V tolerance"
      );
    }
  }

  const deltaDifference = Math.abs(artifact.comparison.delta - pythonArtifact.comparison.delta);
  if (deltaDifference > tolerance) {
    throw new Error(
      "ngspice/Python sensor delta mismatch: " +
      deltaDifference + " V exceeds " + tolerance + " V tolerance"
    );
  }

  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + "\n");

  console.log(
    "✓ ngspice sensor artifact generated and cross-validated: " +
    artifact.baseline.value.toFixed(3) + " V -> " +
    artifact.observed.value.toFixed(3) + " V (delta " +
    artifact.comparison.delta.toFixed(3) + " V)"
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

module.exports = { run };
