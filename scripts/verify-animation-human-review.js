"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "animation", "reviews", "starting-system-voltage-drop-review-template.json");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

const errors = [];
const allowedRoles = ["technical-reviewer", "instructional-reviewer"];
const allowedCriterionDecisions = new Set(["not-reviewed", "pass", "needs-revision"]);

if (template.schemaVersion !== "1.0.0") errors.push("Unexpected review template schemaVersion.");
if (template.artifactType !== "animation-human-review-template") errors.push("Unexpected review template artifactType.");
if (template.animationId !== "starting-system-voltage-drop-review") errors.push("Review template targets the wrong animation.");
if (template.status !== "pending-human-review") errors.push("Committed review template must remain pending-human-review.");

if (JSON.stringify(template.allowedRoles) !== JSON.stringify(allowedRoles)) {
  errors.push("Review template must declare exactly the technical and instructional human reviewer roles.");
}

for (const role of allowedRoles) {
  const criteria = template.criteria?.[role];
  if (!Array.isArray(criteria) || criteria.length === 0) {
    errors.push(role + " must have review criteria.");
    continue;
  }
  const ids = new Set();
  for (const criterion of criteria) {
    if (!criterion.id || !criterion.label) errors.push(role + " criterion is missing id or label.");
    if (ids.has(criterion.id)) errors.push(role + " contains duplicate criterion id: " + criterion.id);
    ids.add(criterion.id);
    if (!allowedCriterionDecisions.has(criterion.decision)) {
      errors.push(role + " criterion has an invalid decision: " + criterion.id);
    }
    if (criterion.decision !== "not-reviewed") {
      errors.push("Committed review template may not contain synthesized human review decisions: " + criterion.id);
    }
  }
}

if (template.record?.reviewRole !== null ||
    template.record?.reviewerName !== null ||
    template.record?.recordedAt !== null ||
    template.record?.overallDecision !== "not-reviewed") {
  errors.push("Committed review template may not contain synthesized reviewer identity, time, role, or decision.");
}

const governance = template.governance || {};
if (governance.humanReviewRequired !== true ||
    governance.publicationEffect !== "none" ||
    governance.assessmentEffect !== "none" ||
    governance.finalApprovalEffect !== "none" ||
    governance.agentMayCompleteReview !== false ||
    governance.agentMayApprove !== false ||
    governance.agentMayRelease !== false) {
  errors.push("Review governance must remain human-gated and have no publication, assessment, or final-approval effect.");
}

if (errors.length) {
  console.error("[FAIL] Starting System animation human-review contract");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("[PASS] Starting System animation human-review contract");
console.log("Roles: " + allowedRoles.join(", "));
console.log("Committed state: pending human review; no publication/assessment/final-approval effect.");
