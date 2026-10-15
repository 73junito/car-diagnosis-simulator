"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const registryPath = path.join(root, "animation", "question-mapping", "starting-system-question-animation-map.js");
const engineeringPath = path.join(root, "data", "circuit-templates", "12v-starting-system.json");
const manifestPath = path.join(root, "animation", "manifests", "starting-system-voltage-drop-review.json");
const questionCatalogPath = path.join(root, "data", "scenario-questions.js");

const engineering = JSON.parse(fs.readFileSync(engineeringPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const questionCatalog = fs.readFileSync(questionCatalogPath, "utf8");

const importUrl = pathToFileURL(registryPath);
const componentIds = new Set(engineering.components.map((item) => item.id));
const connectionIds = new Set(engineering.connections.map((item) => item.id));
const stateIds = new Set(engineering.operatingStates.map((item) => item.id));
const faultIds = new Set(engineering.faultCatalog.map((item) => item.id));
const clipIds = new Set((manifest.presentation?.clips || []).map((item) => item.id));

(async () => {
  const mod = await import(importUrl.href + "?validate=" + Date.now());
  const mappings = mod.STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS;
  const errors = [];

  if (!mappings || typeof mappings !== "object") errors.push("Mapping registry is missing.");

  for (const [questionId, mapping] of Object.entries(mappings || {})) {
    if (!questionCatalog.includes(`id: "${questionId}"`)) {
      errors.push("Mapped question_id is absent from canonical local question catalog: " + questionId);
    }
    if (mapping.scenarioId !== "no-crank") errors.push("Unexpected scenarioId for " + questionId);
    if (mapping.engineering?.artifactRef !== "data/circuit-templates/12v-starting-system.json") {
      errors.push("Wrong engineering artifact for " + questionId);
    }
    if (!stateIds.has(mapping.engineering?.operatingStateId)) {
      errors.push("Unknown operating state for " + questionId + ": " + mapping.engineering?.operatingStateId);
    }
    if (mapping.engineering?.faultId !== null && !faultIds.has(mapping.engineering?.faultId)) {
      errors.push("Unknown fault for " + questionId + ": " + mapping.engineering?.faultId);
    }
    for (const id of mapping.engineering?.componentIds || []) {
      if (!componentIds.has(id)) errors.push("Unknown engineering component for " + questionId + ": " + id);
    }
    for (const id of mapping.engineering?.connectionIds || []) {
      if (!connectionIds.has(id)) errors.push("Unknown engineering connection for " + questionId + ": " + id);
    }
    if (mapping.presentation?.animationId !== manifest.animationId) {
      errors.push("Wrong animationId for " + questionId);
    }
    if (!clipIds.has(mapping.presentation?.clipId)) {
      errors.push("Unknown presentation clip for " + questionId + ": " + mapping.presentation?.clipId);
    }
    if (mapping.presentation?.publicationState !== "review-only") {
      errors.push("Question mapping may not publish the review animation: " + questionId);
    }

    const resolved = mod.resolveQuestionAnimationMapping({ question_id: questionId, scenario_id: mapping.scenarioId });
    if (!resolved) errors.push("Resolver failed for " + questionId);
    if (resolved?.authority?.databaseMayOverrideEngineeringBehavior !== false) {
      errors.push("Database engineering authority boundary missing for " + questionId);
    }
    if (resolved?.authority?.assessmentEligibilityEffect !== "none" ||
        resolved?.authority?.publicationEffect !== "none") {
      errors.push("Mapping has unauthorized assessment/publication effect for " + questionId);
    }
  }

  if (mod.resolveQuestionAnimationMapping({ question_id: "unknown-question", scenario_id: "no-crank" }) !== null) {
    errors.push("Unknown questions must resolve to null.");
  }
  const firstQuestionId = Object.keys(mappings || {})[0];
  if (firstQuestionId && mod.resolveQuestionAnimationMapping({ question_id: firstQuestionId, scenario_id: "wrong-scenario" }) !== null) {
    errors.push("Scenario mismatch must resolve to null.");
  }

  if (manifest.governance?.publicationAllowed !== false ||
      manifest.governance?.assessmentEligible !== false ||
      manifest.governance?.scoredAssessmentApproved !== false) {
    errors.push("Review animation governance boundary changed.");
  }

  if (errors.length) {
    console.error("[FAIL] Starting System question-animation mapping contract");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
  }

  console.log("[PASS] Starting System question-animation mapping contract");
  console.log("Mapped approved-question IDs: " + Object.keys(mappings).length);
  console.log("Electrical authority: engineering artifact");
  console.log("Question authority: instructional context only");
  console.log("Presentation state: review-only; no publication or assessment effect");
})().catch((error) => {
  console.error("[FAIL] Starting System question-animation mapping validator");
  console.error(error);
  process.exit(1);
});
