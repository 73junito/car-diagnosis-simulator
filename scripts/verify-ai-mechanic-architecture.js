"use strict";

const fs = require("fs");
const architecture = JSON.parse(
  fs.readFileSync("data/architecture/ai-mechanic-assistant.json", "utf8")
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(architecture.schemaVersion === "1.0.0", "Unsupported architecture schema");
assert(architecture.runtimeOwnership.canonicalProductAiRoot === "src/ai/",
  "Product AI runtime owner must remain src/ai/");
assert(Array.isArray(architecture.principles) && architecture.principles.length >= 7,
  "Architecture principles are incomplete");
assert(Array.isArray(architecture.components) && architecture.components.length >= 12,
  "Architecture component model is incomplete");

const componentIds = new Set(architecture.components.map((item) => item.id));
for (const required of [
  "ai-orchestrator",
  "ollama-provider",
  "vehicle-identity-resolver",
  "tool-gateway",
  "compliance-authority-registry",
  "deterministic-circuit-engine",
  "evidence-retrieval",
  "evidence-gate",
  "diagnostic-engine",
  "safety-verification-gate",
  "audit-provenance"
]) {
  assert(componentIds.has(required), "Missing architecture component " + required);
}

const externalIds = new Set(architecture.externalTools.map((item) => item.id));
for (const required of ["nhtsa-vpic", "nhtsa-recalls", "nhtsa-complaints", "circuit-engine"]) {
  assert(externalIds.has(required), "Missing external tool boundary " + required);
}

assert(architecture.rag.ingestion.includes("rights-review"),
  "RAG ingestion must include rights review");
assert(architecture.rag.retrieval.includes("reranking"),
  "RAG retrieval must include reranking");
assert(architecture.provenanceRequiredFields.includes("claim_id"),
  "Provenance must map evidence to claims");
assert(architecture.privacyBoundaries.some((rule) => /raw VIN/i.test(rule)),
  "Privacy boundary must address raw VIN");
assert(architecture.responseModes.training && architecture.responseModes.technician,
  "Training and technician response modes must be distinct");
assert(architecture.implementationOrder[0] === "vehicle-identity",
  "Vehicle identity must be the first implementation dependency");
assert(architecture.implementationOrder.includes("compliance-authority-registry"),
  "Implementation order must include the compliance authority registry");
assert(
  architecture.implementationOrder.indexOf("compliance-authority-registry") <
  architecture.implementationOrder.indexOf("deterministic-circuit-engine"),
  "Compliance authority resolution must precede deterministic circuit interpretation"
);
assert(architecture.implementationOrder.includes("deterministic-circuit-engine"),
  "Implementation order must include the deterministic circuit engine before model orchestration");
const circuitTool = architecture.externalTools.find((item) => item.id === "circuit-engine");
assert(circuitTool && circuitTool.access === "read-only",
  "Circuit engine must remain a read-only AI tool boundary");

console.log(
  "[PASS] AI Mechanic architecture verified: " +
  architecture.components.length + " components, " +
  architecture.externalTools.length + " external tool boundaries"
);
