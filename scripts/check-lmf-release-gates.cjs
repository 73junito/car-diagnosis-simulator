"use strict";
const fs = require("node:fs");
const path = require("node:path");
const REQUIRED = Object.freeze({
  "P0-authentication": "P0",
  "P0-migration-parity": "P0",
  "P1-tenant-isolation": "P1",
  "P1-concurrent-append": "P1",
  "P1-crypto-replay": "P1",
  "P1-independent-review": "P1",
  "P2-load-and-recovery": "P2",
  "P2-observability-rollback": "P2",
});
function evaluate(manifest) {
  const errors = [];
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.gates)) return ["Invalid release-evidence manifest"];
  const seen = new Set();
  for (const gate of manifest.gates) {
    if (!gate || !Object.hasOwn(REQUIRED, gate.id) || seen.has(gate.id)) {
      errors.push("Unknown or duplicate gate"); continue;
    }
    seen.add(gate.id);
    if (gate.priority !== REQUIRED[gate.id]) errors.push(gate.id + ": incorrect priority");
    if (!["pending", "passed"].includes(gate.status)) errors.push(gate.id + ": invalid status");
    if (gate.status !== "passed") {errors.push(gate.id + ": pending");continue;}
    if (!/^[a-f0-9]{40}$/i.test(gate.commit || "")) errors.push(gate.id + ": missing immutable commit");
    if (typeof gate.evidence !== "string" || !/^https:\/\/[^\s]+$/i.test(gate.evidence)) errors.push(gate.id + ": missing HTTPS evidence URL");
    if (typeof gate.reviewer !== "string" || !gate.reviewer.trim()) errors.push(gate.id + ": missing reviewer");
    if (typeof gate.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(gate.reviewedAt) || !Number.isFinite(Date.parse(gate.reviewedAt))) errors.push(gate.id + ": missing review date");
  }
  for (const id of Object.keys(REQUIRED)) if (!seen.has(id)) errors.push(id + ": missing required gate");
  return errors;
}
if (require.main === module) {
  const file = path.resolve(__dirname, "../data/lmf/release-evidence.json");
  const errors = evaluate(JSON.parse(fs.readFileSync(file, "utf8")));
  if (errors.length) {
    console.error("LMF RELEASE HOLD: " + errors.length + " unmet/invalid requirements\n" + errors.map(e => "- " + e).join("\n"));
    process.exitCode = 1;
  } else console.log("LMF release evidence checklist complete; independent verification still required.");
}
module.exports = { evaluate, REQUIRED };
