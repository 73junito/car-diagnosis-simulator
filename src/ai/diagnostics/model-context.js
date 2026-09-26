"use strict";

function buildModelContext({ session, evidence = [], mode = null } = {}) {
  if (!session) throw new Error("session is required");

  const vehicle = session.vehicle || {};
  const safeVehicle = {
    year: vehicle.year || null,
    make: vehicle.make || null,
    model: vehicle.model || null,
    trim: vehicle.trim || null,
    engine: vehicle.engine || null,
    drivetrain: vehicle.drivetrain || null,
    market: vehicle.market || null,
    match: vehicle.match || "unknown",
    unresolvedFields: vehicle.unresolvedFields || [],
  };

  return {
    mode: mode || session.mode,
    vehicle: safeVehicle,
    complaint: session.complaint,
    symptoms: [...session.symptoms],
    observations: [...session.observations],
    measurements: [...session.measurements],
    hypotheses: [...session.hypotheses],
    testsPerformed: [...session.testsPerformed],
    evidence: evidence.map((item) => ({
      evidenceId: item.evidenceId,
      claimId: item.claimId,
      claimScope: item.claimScope,
      sourceAuthority: item.sourceAuthority,
      canonicalUrl: item.canonicalUrl,
      vehicleMatch: item.vehicleMatch,
      evidenceStatus: item.evidenceStatus,
    })),
  };
}

module.exports = { buildModelContext };
