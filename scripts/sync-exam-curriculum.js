"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "data", "curriculum");
const targetDir = path.join(root, "exam-site", "data", "curriculum");

const files = [
  "academic-pathways.json",
  "undergraduate-courses.json",
  "graduate-courses.json",
  "competencies.json",
  "lesson-plans.json",
  "scenario-mappings.json",
  "content-policy.json",
  "lesson-content.json",
  "program-architecture.json"
];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);
  if (!fs.existsSync(source)) throw new Error(`Missing canonical curriculum file: ${file}`);
  const content = fs.readFileSync(source);
  JSON.parse(content.toString("utf8"));
  fs.writeFileSync(target, content);
}

console.log(`[PASS] Synced ${files.length} canonical curriculum files to exam-site/data/curriculum`);