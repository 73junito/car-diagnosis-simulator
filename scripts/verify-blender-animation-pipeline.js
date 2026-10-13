"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pipelinePath = path.join(root, "animation", "blender", "pipeline.json");
const generatorPath = path.join(root, "animation", "blender", "scripts", "build_proxy_from_manifest.py");
const runnerPath = path.join(root, "scripts", "run-blender-animation-pipeline.js");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verifyStaticContract() {
  const errors = [];
  const pipeline = JSON.parse(fs.readFileSync(pipelinePath, "utf8"));
  const generator = fs.readFileSync(generatorPath, "utf8");
  const runner = fs.readFileSync(runnerPath, "utf8");

  if (pipeline.phase !== "ANIM-1C") errors.push("pipeline phase must be ANIM-1C");
  if (pipeline.governance?.mayPublish !== false) errors.push("pipeline artifacts must not be publishable");
  if (pipeline.governance?.mayAttachToProductionLesson !== false) errors.push("pipeline artifacts must not attach to production lessons");
  if (pipeline.governance?.assessmentEligible !== false || pipeline.governance?.scoredAssessmentApproved !== false) {
    errors.push("pipeline artifacts must remain outside assessment/scored delivery");
  }
  if (pipeline.governance?.agentMayApprove !== false || pipeline.governance?.agentMayRelease !== false) {
    errors.push("agents may not approve or release generated animation assets");
  }
  if (!generator.includes('export_format="GLB"')) errors.push("generator must export GLB");
  if (!generator.includes('export_extras=True')) errors.push("generator must preserve component metadata as glTF extras");
  if (!generator.includes('"pipeline-validation-only"')) errors.push("generator must mark output pipeline-validation-only");
  if (!runner.includes('"--background"') || !runner.includes('"--factory-startup"')) {
    errors.push("runner must execute Blender headlessly from a factory startup");
  }
  if (!runner.includes("BLENDER_EXE")) errors.push("runner must support BLENDER_EXE override");
  if (!runner.includes("did not produce the required GLB and metadata outputs")) {
    errors.push("runner must fail closed when Blender returns without required outputs");
  }
  if (runner.includes("AppData") || runner.includes("rod63")) errors.push("runner must not contain user-profile-specific paths");

  return { errors, pipeline, generatorSha256: sha256(generatorPath) };
}

function validateGeneratedAsset(glbPath, metadataPath) {
  const errors = [];
  if (!fs.existsSync(glbPath)) errors.push("GLB output is missing");
  if (!fs.existsSync(metadataPath)) errors.push("metadata sidecar is missing");
  if (errors.length) return { errors };

  const bytes = fs.readFileSync(glbPath);
  if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "glTF") {
    errors.push("output is not a valid GLB header");
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const outputSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (metadata.outputSha256 !== outputSha256) errors.push("metadata outputSha256 does not match GLB");
  if (metadata.outputBytes !== bytes.length) errors.push("metadata outputBytes does not match GLB size");
  if (metadata.assetStatus !== "pipeline-validation-only" || metadata.mayPublish !== false) {
    errors.push("generated asset governance status is invalid");
  }
  if (metadata.assessmentEligible !== false || metadata.scoredAssessmentApproved !== false) {
    errors.push("generated asset crossed assessment boundary");
  }
  if (metadata.agentMayApprove !== false || metadata.agentMayRelease !== false) {
    errors.push("generated asset crossed agent approval boundary");
  }
  if (!Array.isArray(metadata.componentIds) || metadata.componentIds.length === 0) {
    errors.push("generated asset metadata has no component ids");
  }
  return { errors, metadata };
}

if (require.main === module) {
  const result = verifyStaticContract();
  if (result.errors.length) {
    console.error("[FAIL] Blender animation pipeline contract failed");
    for (const error of result.errors) console.error("  - " + error);
    process.exit(1);
  }
  console.log("[PASS] Blender animation pipeline contract preserved; generator sha256=" + result.generatorSha256);
}

module.exports = { verifyStaticContract, validateGeneratedAsset };
