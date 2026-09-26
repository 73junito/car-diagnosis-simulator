"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const registryPath = path.join(root, "data/compliance/authority-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const allowedTypes = new Set([
  "federal-regulation",
  "state-law-or-regulation",
  "incorporated-standard",
  "non-incorporated-standard",
  "oem-authoritative-service-information",
  "supplier-technical-reference",
  "project-authored-training-model",
  "ai-explanation"
]);

assert(registry.schemaVersion === "1.0.0", "schemaVersion must be 1.0.0");
assert(registry.registryType === "governing-authority", "registryType must be governing-authority");
assert(Array.isArray(registry.authorityOrder) && registry.authorityOrder.length >= 8,
  "authorityOrder must define the complete hierarchy");
assert(registry.authorityOrder[0] === "federal-regulation",
  "federal-regulation must be the first authority class");
assert(registry.authorityOrder.at(-1) === "ai-explanation",
  "AI explanation must remain the lowest authority class");
assert(registry.rules?.ai_is_never_source_of_truth === true,
  "AI must never be source of truth");
assert(registry.rules?.vehicle_specific_claims_require_authoritative_vehicle_source === true,
  "vehicle-specific claims must require authoritative vehicle information");
assert(registry.rules?.standard_is_not_law_unless_incorporated_or_otherwise_made_binding === true,
  "standards must not be treated as law by default");
assert(registry.rules?.copyrighted_standard_text_may_not_be_ingested_without_license === true,
  "copyrighted standards must fail closed for ingestion");

const seen = new Set();
for (const authority of registry.authorities || []) {
  assert(typeof authority.authorityId === "string" && authority.authorityId.length > 0,
    "every authority requires authorityId");
  assert(!seen.has(authority.authorityId), "duplicate authorityId " + authority.authorityId);
  seen.add(authority.authorityId);

  assert(allowedTypes.has(authority.authorityType),
    authority.authorityId + ": unsupported authorityType " + authority.authorityType);
  assert(typeof authority.jurisdiction === "string" && authority.jurisdiction.length > 0,
    authority.authorityId + ": jurisdiction is required");
  assert(typeof authority.documentId === "string" && authority.documentId.length > 0,
    authority.authorityId + ": documentId is required");
  assert(typeof authority.canonicalUrl === "string" && authority.canonicalUrl.startsWith("https://"),
    authority.authorityId + ": canonicalUrl must be HTTPS");
  assert(authority.fullTextIngestionAllowed === false,
    authority.authorityId + ": seeded authority text must remain non-ingestible until a separate rights/license decision permits reuse");

  if (authority.authorityType === "non-incorporated-standard") {
    assert(authority.incorporatedByReference === false,
      authority.authorityId + ": non-incorporated standard cannot claim incorporation");
    assert(authority.bindingStatus === "standard-not-automatically-law",
      authority.authorityId + ": non-incorporated standard must not be represented as binding law");
  }

  if (authority.authorityType === "federal-regulation" || authority.authorityType === "state-law-or-regulation") {
    assert(authority.bindingStatus === "binding-when-applicable",
      authority.authorityId + ": regulation/law must use binding-when-applicable");
  }
}

assert([...seen].some((id) => id.startsWith("us-federal-")),
  "registry requires at least one federal authority");
assert([...seen].some((id) => id.startsWith("ks-")),
  "registry requires at least one Kansas authority");
assert([...seen].some((id) => id.startsWith("iso-")),
  "registry requires at least one ISO authority");

if (errors.length) {
  console.error("[FAIL] Compliance authority contract violated");
  for (const error of errors) console.error("  - " + error);
  process.exit(1);
}

console.log(
  "[PASS] Compliance authority verified: " +
  registry.authorities.length +
  " seeded authorities; federal/state/ISO hierarchy preserved"
);
