"use strict";

const fs = require("fs");
const path = require("path");
const { validateSymbolDefinition, SYMBOL_DOMAINS } = require("../src/symbols/contracts");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data", "symbols");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

const manifest = readJson(path.join(DATA, "manifest.json"));
const errors = [];
const ids = new Set();
let total = 0;

if (manifest.schemaVersion !== "1.0.0") errors.push("manifest schemaVersion must be 1.0.0");
if (!manifest.coordinateSystem || manifest.coordinateSystem.width !== 100 || manifest.coordinateSystem.height !== 100) {
  errors.push("manifest coordinate system must be 100x100 logical units");
}

for (const domainEntry of manifest.domains || []) {
  if (!SYMBOL_DOMAINS.includes(domainEntry.id)) errors.push(`manifest has unsupported domain: ${domainEntry.id}`);
  const file = path.join(DATA, domainEntry.file);
  if (!fs.existsSync(file)) {
    errors.push(`missing catalog: ${domainEntry.file}`);
    continue;
  }

  const catalog = readJson(file);
  if (catalog.domain !== domainEntry.id) errors.push(`${domainEntry.file}: domain mismatch`);
  if (!Array.isArray(catalog.standardReferences) || catalog.standardReferences.length === 0) {
    errors.push(`${domainEntry.file}: standardReferences required`);
  }

  for (const symbol of catalog.symbols || []) {
    total += 1;
    const symbolErrors = validateSymbolDefinition(symbol);
    for (const error of symbolErrors) errors.push(`${symbol.id || "<unknown>"}: ${error}`);
    if (ids.has(symbol.id)) errors.push(`duplicate symbol id: ${symbol.id}`);
    ids.add(symbol.id);
    if (symbol.domain !== catalog.domain) errors.push(`${symbol.id}: symbol/catalog domain mismatch`);
    for (const terminal of symbol.terminals || []) {
      if (typeof terminal.x !== "number" || typeof terminal.y !== "number") errors.push(`${symbol.id}: terminal coordinates required`);
      if (terminal.x < 0 || terminal.x > 100 || terminal.y < 0 || terminal.y > 100) errors.push(`${symbol.id}: terminal outside 100x100 grid`);
    }
  }
}

if (errors.length) {
  console.error("Symbol library validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`✓ Symbol library validation passed: ${total} symbols across ${manifest.domains.length} domains`);
