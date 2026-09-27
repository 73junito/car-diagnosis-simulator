"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { validateArtifact } = require("../../scripts/verify-engineering-artifacts");

const root = path.join(__dirname, "..", "..");
const netlistPath = path.join(__dirname, "relay-load-high-resistance.cir");
const schemaPath = path.join(root, "data", "engineering", "schemas", "engineering-model-artifact.schema.json");
const pythonArtifactPath = path.join(root, "data", "engineering", "generated", "relay-load-high-resistance.json");
const outputPath = path.join(root, "data", "engineering", "generated", "relay-load-high-resistance-ngspice.json");

function parseScalar(output, name) {
  const escaped = name.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(escaped + "\\s*=\\s*([-+0-9.eE]+)", "i"));
  if (!match) throw new Error("Unable to parse " + name + " from ngspice output");
  const value = Number(match[1]);
  if (!Number.isFinite(value)) throw new Error("Non-finite ngspice value for " + name);
  return value;
}

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

  const healthy = parseScalar(output, "tm_healthy");
  const fault = parseScalar(output, "tm_fault");
  const delta = fault - healthy;

  const artifact = {
    schemaVersion: "1.0.0",
    artifactId: "relay-load-high-resistance-ngspice-v1",
    modelId: "relay-high-resistance-training-model-ngspice",
    evidenceRole: "project_authored_training_model",
    generator: { tool: "ngspice", version: ngspiceVersion() },
    domain: {
      system: "low-voltage-relay-load",
      voltageClass: "12V-training-example",
      applicability: "generic project-authored training model only"
    },
    quantity: { quantityType: "current", unit: "A" },
    baseline: { value: Number(healthy.toFixed(3)), label: "healthy SPICE model" },
    observed: { value: Number(fault.toFixed(3)), label: "high-resistance SPICE model" },
    comparison: {
      status: Math.abs(delta) > 1e-9 ? "changed" : "unchanged",
      delta: Number(delta.toFixed(3)),
      interpretation: "numeric_delta_only",
      authoritativeSpecification: false,
      reason: "ngspice project-authored training-model delta; not a vehicle specification."
    },
    provenance: {
      method: "ngspice DC operating-point simulation using project-authored resistance values",
      sourceType: "project_model",
      reproducible: true
    }
  };

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const errors = validateArtifact(artifact, schema);
  if (errors.length) throw new Error("Generated ngspice artifact is invalid:\n- " + errors.join("\n- "));

  const pythonArtifact = JSON.parse(fs.readFileSync(pythonArtifactPath, "utf8"));
  const tolerance = 0.001;
  for (const key of ["baseline", "observed"]) {
    const difference = Math.abs(artifact[key].value - pythonArtifact[key].value);
    if (difference > tolerance) {
      throw new Error("ngspice/Python " + key + " mismatch: " + difference + " A exceeds " + tolerance + " A tolerance");
    }
  }
  const deltaDifference = Math.abs(artifact.comparison.delta - pythonArtifact.comparison.delta);
  if (deltaDifference > tolerance) {
    throw new Error("ngspice/Python delta mismatch: " + deltaDifference + " A exceeds " + tolerance + " A tolerance");
  }

  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + "\n");
  console.log(
    "✓ ngspice relay/load artifact generated and cross-validated: " +
    artifact.baseline.value.toFixed(3) + " A -> " +
    artifact.observed.value.toFixed(3) + " A (delta " +
    artifact.comparison.delta.toFixed(3) + " A)"
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

module.exports = { parseScalar };
