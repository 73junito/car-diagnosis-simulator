"use strict";

const EVIDENCE_STATUS = Object.freeze([
  "supported",
  "partially-supported",
  "conflicting",
  "insufficient"
]);

const VEHICLE_MATCH = Object.freeze([
  "exact",
  "partial",
  "generic",
  "unknown"
]);

const SOURCE_AUTHORITY = Object.freeze([
  "primary",
  "secondary",
  "instructional"
]);

const CLAIM_SCOPE = Object.freeze([
  "general",
  "vehicle-specific"
]);

const SESSION_MODE = Object.freeze([
  "training",
  "technician"
]);

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(field + " must be a non-empty string");
  }
  return value.trim();
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new Error(field + " must be one of: " + allowed.join(", "));
  }
  return value;
}

function createVehicleIdentity(input = {}) {
  const identity = {
    vin: typeof input.vin === "string" && input.vin.trim() ? input.vin.trim().toUpperCase() : null,
    year: input.year == null ? null : Number(input.year),
    make: input.make ? String(input.make).trim() : null,
    model: input.model ? String(input.model).trim() : null,
    trim: input.trim ? String(input.trim).trim() : null,
    engine: input.engine ? String(input.engine).trim() : null,
    drivetrain: input.drivetrain ? String(input.drivetrain).trim() : null,
    market: input.market ? String(input.market).trim() : null,
    source: input.source ? String(input.source).trim() : null,
    match: oneOf(input.match || "unknown", VEHICLE_MATCH, "vehicle identity match"),
    unresolvedFields: Array.isArray(input.unresolvedFields)
      ? [...new Set(input.unresolvedFields.map(String))]
      : [],
  };

  if (identity.year !== null && (!Number.isInteger(identity.year) || identity.year < 1886)) {
    throw new Error("vehicle identity year must be a plausible integer");
  }

  return Object.freeze(identity);
}

function createToolResult(input = {}) {
  return Object.freeze({
    tool: requireString(input.tool, "tool"),
    sourceType: requireString(input.sourceType, "sourceType"),
    retrievedAt: requireString(input.retrievedAt || new Date().toISOString(), "retrievedAt"),
    vehicleMatch: oneOf(input.vehicleMatch || "unknown", VEHICLE_MATCH, "vehicleMatch"),
    canonicalUrl: input.canonicalUrl ? String(input.canonicalUrl) : null,
    cacheStatus: input.cacheStatus || "unknown",
    normalizedData: input.normalizedData && typeof input.normalizedData === "object"
      ? input.normalizedData
      : {},
  });
}

function createEvidenceRecord(input = {}) {
  return Object.freeze({
    evidenceId: requireString(input.evidenceId, "evidenceId"),
    claimId: requireString(input.claimId, "claimId"),
    claimScope: oneOf(input.claimScope || "general", CLAIM_SCOPE, "claimScope"),
    sourceId: requireString(input.sourceId, "sourceId"),
    sourceType: requireString(input.sourceType, "sourceType"),
    sourceAuthority: oneOf(input.sourceAuthority, SOURCE_AUTHORITY, "sourceAuthority"),
    sourceApproval: input.sourceApproval === "approved" ? "approved" : "not-approved",
    canonicalUrl: input.canonicalUrl ? String(input.canonicalUrl) : null,
    artifactSha256: input.artifactSha256 ? String(input.artifactSha256) : null,
    chunkId: input.chunkId ? String(input.chunkId) : null,
    vehicleMatch: oneOf(input.vehicleMatch || "unknown", VEHICLE_MATCH, "vehicleMatch"),
    evidenceStatus: oneOf(input.evidenceStatus || "insufficient", EVIDENCE_STATUS, "evidenceStatus"),
    directlyRelevant: input.directlyRelevant === true,
    currentEnough: input.currentEnough !== false,
    verificationRequired: input.verificationRequired !== false,
  });
}

function createDiagnosticDecision(input = {}) {
  return Object.freeze({
    decisionId: requireString(input.decisionId, "decisionId"),
    hypothesis: requireString(input.hypothesis, "hypothesis"),
    supportingEvidenceIds: Array.isArray(input.supportingEvidenceIds) ? [...input.supportingEvidenceIds] : [],
    conflictingEvidenceIds: Array.isArray(input.conflictingEvidenceIds) ? [...input.conflictingEvidenceIds] : [],
    missingEvidence: Array.isArray(input.missingEvidence) ? [...input.missingEvidence] : [],
    recommendedNextCheck: input.recommendedNextCheck ? String(input.recommendedNextCheck) : null,
    vehicleSpecificProcedureRequired: input.vehicleSpecificProcedureRequired === true,
    verificationRequired: input.verificationRequired !== false,
    status: input.status || "proposed",
  });
}

function createDiagnosticSession(input = {}) {
  return {
    sessionId: requireString(input.sessionId, "sessionId"),
    mode: oneOf(input.mode || "training", SESSION_MODE, "mode"),
    vehicle: createVehicleIdentity(input.vehicle || {}),
    complaint: input.complaint ? String(input.complaint) : "",
    symptoms: Array.isArray(input.symptoms) ? [...input.symptoms] : [],
    observations: Array.isArray(input.observations) ? [...input.observations] : [],
    measurements: Array.isArray(input.measurements) ? [...input.measurements] : [],
    hypotheses: Array.isArray(input.hypotheses) ? [...input.hypotheses] : [],
    eliminatedHypotheses: Array.isArray(input.eliminatedHypotheses) ? [...input.eliminatedHypotheses] : [],
    testsPerformed: Array.isArray(input.testsPerformed) ? [...input.testsPerformed] : [],
    evidenceIds: Array.isArray(input.evidenceIds) ? [...input.evidenceIds] : [],
    technicianDecisions: Array.isArray(input.technicianDecisions) ? [...input.technicianDecisions] : [],
    finalVerification: input.finalVerification || null,
  };
}

module.exports = {
  EVIDENCE_STATUS,
  VEHICLE_MATCH,
  SOURCE_AUTHORITY,
  CLAIM_SCOPE,
  SESSION_MODE,
  createVehicleIdentity,
  createToolResult,
  createEvidenceRecord,
  createDiagnosticDecision,
  createDiagnosticSession,
};
