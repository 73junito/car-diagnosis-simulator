"use strict";

const fs = require("fs");
const path = require("path");
const engine = require("../src/circuits/engine");

const root = path.resolve(__dirname, "..");
const directory = path.join(root, "data/circuits");
const errors = [];
let checked = 0;

for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
  const circuit = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  checked += 1;

  const validation = engine.validateCircuit(circuit);
  if (!validation.valid) {
    errors.push(...validation.errors.map((error) => `${file}: ${error}`));
  }

  if (circuit.vehicleApplicability?.vehicleSpecific === false) {
    if (circuit.curriculum?.assessmentUse !== "training-only") {
      errors.push(`${file}: generic circuit must remain training-only`);
    }
    if (circuit.provenance?.scoredAssessmentApproved !== false) {
      errors.push(`${file}: generic circuit must not be scored-assessment approved`);
    }

    const serialized = JSON.stringify(circuit);
    const prohibited = [
      "expectedVoltage", "expectedCurrent", "expectedResistance", "serviceLimit",
      "torqueSpecification", "manufacturerPin", "oemProcedure"
    ];
    for (const field of prohibited) {
      if (serialized.includes(`"${field}"`)) {
        errors.push(`${file}: generic circuit may not contain vehicle-specific field ${field}`);
      }
    }
  }

  for (const point of circuit.testPoints || []) {
    if (point.vehicleSpecificValueRequired !== true) {
      errors.push(`${file}: test point ${point.id} must explicitly require vehicle-specific values`);
    }
  }

  const connectionIds = new Set(circuit.connections.map((connection) => connection.id));
  for (const fault of circuit.faultCatalog || []) {
    if (!connectionIds.has(fault.targetConnectionId)) {
      errors.push(`${file}: fault ${fault.id} references unknown connection ${fault.targetConnectionId}`);
    }
  }
}

if (errors.length) {
  console.error("[FAIL] Circuit model validation failed");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`[PASS] Circuit model validation: ${checked} circuit(s), generic training boundary preserved`);
