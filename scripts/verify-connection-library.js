"use strict";

const fs = require("fs");
const path = require("path");
const { validateConnectionStyle } = require("../src/connections/contracts");
const engine = require("../src/circuits/engine");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function main() {
  const root = path.resolve(__dirname, "..");
  const catalog = readJson(path.join(root, "data", "connections", "electrical.json"));
  const circuit = readJson(path.join(root, "data", "circuits", "generic-charging-system.json"));
  const errors = [];
  const ids = new Set();

  for (const style of catalog.styles || []) {
    for (const error of validateConnectionStyle(style)) errors.push(`${style.id || "style"}: ${error}`);
    if (ids.has(style.id)) errors.push(`duplicate connection style id: ${style.id}`);
    ids.add(style.id);
  }

  const circuitValidation = engine.validateCircuit(circuit);
  errors.push(...circuitValidation.errors);
  for (const connection of circuit.connections || []) {
    if (!ids.has(connection.styleId)) errors.push(`connection ${connection.id} references unknown style ${connection.styleId}`);
  }

  if (errors.length) {
    console.error("Connection library validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`✓ Connection library validation passed: ${catalog.styles.length} electrical styles`);
}

main();
