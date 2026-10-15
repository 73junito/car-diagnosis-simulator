"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readinessPath = path.join(root, "animation", "promotion", "starting-system-voltage-drop-promotion.json");

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function sha256(relative) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}

function fail(errors) {
  console.error("[FAIL] Starting System controlled-promotion contract");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

const readiness = JSON.parse(fs.readFileSync(readinessPath, "utf8"));
const errors = [];

if (readiness.schemaVersion !== "1.0.0") errors.push("Unexpected promotion schemaVersion.");
if (readiness.artifactType !== "animation-controlled-promotion-readiness") errors.push("Unexpected artifactType.");
if (readiness.animationId !== "starting-system-voltage-drop-review") errors.push("Promotion record targets the wrong animation.");

const sourceManifest = readJson(readiness.sourceManifest);
const productionManifest = readJson(readiness.productionManifest);

if (sourceManifest.animationId !== readiness.animationId) errors.push("Source review manifest does not match promotion animationId.");
if (sourceManifest.governance?.publicationAllowed !== false ||
    sourceManifest.governance?.assessmentEligible !== false ||
    sourceManifest.governance?.scoredAssessmentApproved !== false ||
    sourceManifest.governance?.agentMayApprove !== false ||
    sourceManifest.governance?.agentMayRelease !== false) {
  errors.push("Source review manifest has crossed the review-only governance boundary.");
}
if (productionManifest.governance?.publicationAllowed !== false ||
    productionManifest.governance?.assessmentEligible !== false ||
    productionManifest.governance?.scoredAssessmentApproved !== false) {
  errors.push("Existing production foundation manifest must remain unpublished and assessment-ineligible during promotion preparation.");
}

const expectedRoles = ["technical-reviewer", "instructional-reviewer"];
const reviews = readiness.requiredHumanReviews || [];
if (reviews.map((item) => item.role).join("|") !== expectedRoles.join("|")) {
  errors.push("Promotion must require exactly technical and instructional human review roles.");
}

let technicalPassed = false;
let instructionalPassed = false;

for (const review of reviews) {
  if (review.requiredDecision !== "pass") errors.push("Human review requiredDecision must be pass: " + review.role);
  if (!review.recordPath) continue;
  const record = readJson(review.recordPath);
  if (record.artifactType !== "animation-human-review-record") errors.push("Invalid human review artifactType for " + review.role);
  if (record.animationId !== readiness.animationId) errors.push("Human review targets wrong animation for " + review.role);
  if (record.reviewRole !== review.role) errors.push("Human review role mismatch for " + review.role);
  if (!record.reviewerName || !record.recordedAt) errors.push("Human review must contain reviewer identity and timestamp for " + review.role);
  if (record.overallDecision !== "pass") errors.push("Human review did not pass for " + review.role);
  if (record.governance?.publicationEffect !== "none" ||
      record.governance?.assessmentEffect !== "none" ||
      record.governance?.finalApprovalEffect !== "none" ||
      record.governance?.agentMayApprove !== false ||
      record.governance?.agentMayRelease !== false) {
    errors.push("Human review record exceeds review-only authority for " + review.role);
  }
  if (review.role === "technical-reviewer" && record.overallDecision === "pass") technicalPassed = true;
  if (review.role === "instructional-reviewer" && record.overallDecision === "pass") instructionalPassed = true;
}

let finalApprovalPassed = false;
if (readiness.finalApproval?.recordPath) {
  const approval = readJson(readiness.finalApproval.recordPath);
  if (approval.artifactType !== "animation-human-final-publication-approval") errors.push("Invalid final approval artifactType.");
  if (approval.animationId !== readiness.animationId) errors.push("Final approval targets the wrong animation.");
  if (approval.finalDecision !== readiness.finalApproval.requiredDecision) errors.push("Final human publication decision is not approved.");
  if (!approval.reviewerIdentity || !approval.reviewedAt) errors.push("Final approval requires named human identity and timestamp.");
  if (approval.agentSynthesizedDecision !== false) errors.push("Final approval may not be agent-synthesized.");
  if (approval.assessmentEligible !== false || approval.scoredAssessmentApproved !== false) {
    errors.push("Final publication approval may not grant assessment eligibility or scored-assessment approval.");
  }
  finalApprovalPassed = approval.finalDecision === readiness.finalApproval.requiredDecision &&
    Boolean(approval.reviewerIdentity) && Boolean(approval.reviewedAt) && approval.agentSynthesizedDecision === false;
}

const assetHashVerified = fs.existsSync(path.join(root, readiness.reviewAsset)) &&
  sourceManifest.rendering?.assetPath === readiness.reviewAsset &&
  sha256(readiness.reviewAsset).length === 64;
const manifestContractVerified = sourceManifest.schemaVersion === "1.1.0" &&
  sourceManifest.presentation?.mode === "animated";

const expectedGates = {
  technicalReviewPassed: technicalPassed,
  instructionalReviewPassed: instructionalPassed,
  finalHumanApprovalRecorded: finalApprovalPassed,
  assetHashVerified,
  manifestContractVerified,
  productionAllowlistUpdateAuthorized: false
};

for (const [key, value] of Object.entries(expectedGates)) {
  if (readiness.gates?.[key] !== value) {
    errors.push("Recorded gate does not match evidence: " + key + " expected " + value);
  }
}

const ready = technicalPassed && instructionalPassed && finalApprovalPassed && assetHashVerified && manifestContractVerified;
if (readiness.governance?.promotionMayProceed !== false ||
    readiness.governance?.publicationAllowed !== false ||
    readiness.governance?.assessmentEligible !== false ||
    readiness.governance?.scoredAssessmentApproved !== false ||
    readiness.governance?.agentMayApprove !== false ||
    readiness.governance?.agentMayRelease !== false ||
    readiness.governance?.automationMayReject !== true ||
    readiness.governance?.automationMayPromote !== false) {
  errors.push("Committed promotion readiness must remain fail-closed and non-publishing.");
}

if (ready) {
  errors.push("Human evidence is complete but committed readiness still requires an explicit separate promotion authorization step; do not auto-promote.");
}

if (errors.length) fail(errors);

console.log("[PASS] Starting System controlled-promotion contract");
console.log("Technical review: " + (technicalPassed ? "PASS" : "MISSING"));
console.log("Instructional review: " + (instructionalPassed ? "PASS" : "MISSING"));
console.log("Final human publication approval: " + (finalApprovalPassed ? "PASS" : "MISSING"));
console.log("Asset hash evidence: " + (assetHashVerified ? "PASS" : "FAIL"));
console.log("Manifest contract: " + (manifestContractVerified ? "PASS" : "FAIL"));
console.log("Promotion state: BLOCKED — explicit human evidence and separate authorization required.");
