"use strict";

function evaluateEvidenceGate({ evidence = [], vehicle = null } = {}) {
  const reasons = [];

  if (!Array.isArray(evidence) || evidence.length === 0) {
    return { allowed: false, status: "insufficient", reasons: ["No evidence supplied"] };
  }

  for (const item of evidence) {
    if (!item || item.sourceApproval !== "approved") {
      reasons.push("Evidence source is not approved");
      continue;
    }
    if (item.directlyRelevant !== true) reasons.push("Evidence is not directly relevant");
    if (item.currentEnough === false) reasons.push("Evidence is not current enough");
    if (item.evidenceStatus === "insufficient") reasons.push("Evidence status is insufficient");

    if (item.claimScope === "vehicle-specific") {
      if (item.sourceAuthority !== "primary") {
        reasons.push("Vehicle-specific claim lacks a primary authoritative source");
      }
      if (!["exact", "partial"].includes(item.vehicleMatch)) {
        reasons.push("Vehicle-specific evidence does not match the resolved vehicle");
      }
      if (!vehicle || !["exact", "partial"].includes(vehicle.match)) {
        reasons.push("Vehicle identity is not sufficiently resolved");
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    status: reasons.length === 0 ? "supported" : "insufficient",
    reasons: [...new Set(reasons)],
  };
}

module.exports = { evaluateEvidenceGate };
