#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, ".ai", "rag");
const outPath = path.join(outDir, "system-map.md");

const includeDirs = [
  "core",
  "api",
  "dashboard",
  "lib",
  "services",
  "scripts",
  "tests",
  "docs",
  ".github"
];

const ignoreDirs = new Set([
  "node_modules",
  ".git",
  ".ai",
  "coverage",
  "test-results",
  "reports",
  "runs",
  "dist",
  "build"
]);

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir, depth = 0, maxDepth = 3) {
  if (depth > maxDepth || !isDir(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !ignoreDirs.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const indent = "  ".repeat(depth);

    if (entry.isDirectory()) {
      lines.push(`${indent}- ${entry.name}/`);
      lines.push(...walk(full, depth + 1, maxDepth));
    } else {
      lines.push(`${indent}- ${entry.name}`);
    }
  }

  return lines;
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let md = "# System Map\n\n";
md += `Generated: ${new Date().toISOString()}\n\n`;

for (const dir of includeDirs) {
  const full = path.join(root, dir);
  if (!isDir(full)) continue;

  md += `## ${dir}/\n\n`;
  md += walk(full, 0, 2).join("\n");
  md += "\n\n";
}

fs.writeFileSync(outPath, md, "utf8");
console.log(`System map written: ${outPath}`);
