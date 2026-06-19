#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const purpose = process.argv[2] || "architecture";

const ragFile = path.join(
  root,
  ".ai",
  "rag",
  `${purpose}-context.md`
);

const REQUIRED = {
  architecture: [
    "core\\",
    "api\\",
    "dashboard\\",
    "lib\\",
    "services\\"
  ],
  code_review: [
    "core\\",
    "api\\",
    "dashboard\\",
    "scripts\\",
    "tests\\"
  ],
  playwright_debugging: [
    "tests\\playwright\\",
    "dashboard\\"
  ],
  github_actions: [
    ".github\\",
    "scripts\\"
  ]
};

function normalize(text) {
  return String(text || "")
    .replace(/\//g, "\\")
    .toLowerCase();
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(ragFile)) {
  fail(`Missing context file: ${ragFile}`);
}

const content = fs.readFileSync(ragFile, "utf8");

if (!content.trim()) {
  fail("Context file is empty");
}

const sourceMatches =
  content.match(/^# SOURCE\s+\d+/gm) || [];

const sourceCount = sourceMatches.length;

if (sourceCount < 10) {
  fail(
    `Only ${sourceCount} sources found. Expected at least 10.`
  );
}

const text = normalize(content);

const required =
  REQUIRED[purpose] ||
  REQUIRED.architecture;

let found = 0;

console.log("");
console.log("====================================");
console.log("RAG CONTEXT VALIDATION");
console.log("====================================");
console.log(`Purpose: ${purpose}`);
console.log(`Sources: ${sourceCount}`);
console.log(`Size: ${content.length.toLocaleString()} chars`);
console.log("");

for (const folder of required) {
  const present = text.includes(
    normalize(folder)
  );

  if (present) {
    found++;
    console.log(`✓ ${folder}`);
  } else {
    console.log(`✗ ${folder}`);
  }
}

const coverage =
  Math.round(
    (found / required.length) * 100
  );

console.log("");
console.log(`Coverage: ${coverage}%`);
console.log("");

if (coverage < 80) {
  fail(
    `Coverage below threshold (${coverage}%)`
  );
}

if (content.length < 5000) {
  fail(
    `Context too small (${content.length} chars)`
  );
}

console.log("Context validation PASSED");
console.log("");

process.exit(0);