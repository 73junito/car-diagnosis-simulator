"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "animation", "cadquery", "pipeline.json");
const resolverPath = path.join(root, "scripts", "resolve-cadquery-environment.js");

function verifyCadQueryPipeline() {
  const errors = [];
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const resolver = fs.readFileSync(resolverPath, "utf8");

  if (config.phase !== "ANIM-1C-CAD") errors.push("CadQuery pipeline phase must be ANIM-1C-CAD");
  if (config.stageRole !== "upstream-geometry-authoring-for-governed-3d-assets") {
    errors.push("CadQuery stage role must remain upstream geometry authoring");
  }
  if (config.outputs?.directGlbPublicationAllowed !== false) {
    errors.push("CadQuery must not directly authorize GLB publication");
  }
  if (config.outputs?.downstreamPipeline !== "animation/blender/pipeline.json") {
    errors.push("CadQuery outputs must feed the governed Blender pipeline");
  }

  const governance = config.governance || {};
  for (const flag of [
    "engineeringAuthority",
    "measurementAuthority",
    "assessmentAuthority",
    "publicationAuthority",
    "controlsEngineeringState"
  ]) {
    if (governance[flag] !== false) errors.push("CadQuery governance." + flag + " must be false");
  }
  if (governance.geometryAuthoringOnly !== true) errors.push("CadQuery stage must remain geometry-authoring-only");
  if (governance.humanApprovalRequired !== true) errors.push("CadQuery stage must require human approval");
  if (governance.agentMayApprove !== false || governance.agentMayRelease !== false) {
    errors.push("CadQuery stage may not approve or release assets");
  }

  if (!resolver.includes("CADQUERY_PYTHON")) errors.push("CadQuery resolver must support CADQUERY_PYTHON");
  if (!resolver.includes("CADQUERY_ENV")) errors.push("CadQuery resolver must support CADQUERY_ENV");
  if (!resolver.includes("USERPROFILE")) errors.push("CadQuery resolver must support USERPROFILE-relative discovery");
  if (resolver.includes("rod63")) errors.push("CadQuery resolver must not hardcode a personal user profile");
  if (resolver.includes("C:\\Users\\")) errors.push("CadQuery resolver must not hardcode a Windows user path");

  return { errors, config };
}

if (require.main === module) {
  const result = verifyCadQueryPipeline();
  if (result.errors.length) {
    console.error("[FAIL] CadQuery 3D asset pipeline contract failed");
    for (const error of result.errors) console.error("  - " + error);
    process.exit(1);
  }
  console.log("[PASS] CadQuery 3D asset authoring pipeline contract preserved");
}

module.exports = { verifyCadQueryPipeline };
