"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const production = path.join(root, "dist");
const reviewOutput = path.join(root, "review-dist");

const reviewEntries = [
  "animation/review-harness/starting-system.html",
  "animation/review-harness/review-harness.css",
  "animation/review-harness/review-harness.js",
  "animation/reviews/starting-system-voltage-drop-review-template.json",
  "animation/manifests/starting-system-voltage-drop-review.json",
  "animation/review-assets/starting-system-voltage-drop-review.glb",
  "animation/review-assets/starting-system-voltage-drop-review.svg",
  "animation/review-assets/starting-system-voltage-drop-review.metadata.json",
];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function copy(relative) {
  const source = path.join(root, relative);
  const destination = path.join(reviewOutput, relative);
  if (!fs.existsSync(source)) throw new Error("Review source is missing: " + relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const manifest = readJson("animation/manifests/starting-system-voltage-drop-review.json");
if (manifest.governance?.publicationAllowed !== false ||
    manifest.governance?.humanApprovalRecorded !== false ||
    manifest.governance?.assessmentEligible !== false ||
    manifest.governance?.scoredAssessmentApproved !== false) {
  throw new Error("Refusing to assemble review harness after review-only governance boundary changed.");
}
if (manifest.presentation?.mode !== "animated") {
  throw new Error("Starting System review harness requires the animated review manifest.");
}

if (!fs.existsSync(production)) {
  throw new Error("Production dist is missing. Run npm run build before assembling the review harness.");
}

fs.rmSync(reviewOutput, { recursive: true, force: true });
fs.cpSync(production, reviewOutput, { recursive: true });
for (const relative of reviewEntries) copy(relative);

console.log("Starting System animation review harness assembled.");
console.log("Output: " + reviewOutput);
console.log("Review page: /animation/review-harness/starting-system.html");
console.log("Review-only entries added: " + reviewEntries.length);
