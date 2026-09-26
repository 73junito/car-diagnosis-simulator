"use strict";

const { evaluateEvidenceGate } = require("./evidence-gate");

function evaluateDiagnosticDecision({ session, decision, evidence = [] } = {}) {
  if (!session || !decision) throw new Error("session and decision are required");

  const gate = evaluateEvidenceGate({ evidence, vehicle: session.vehicle });

  if (!gate.allowed) {
    return {
      status: "blocked",
      decision: null,
      evidenceGate: gate,
      nextAction: "collect-more-evidence",
      verificationRequired: true,
    };
  }

  return {
    status: "ready-for-technician-verification",
    decision: {
      ...decision,
      status: "evidence-supported",
      verificationRequired: true,
    },
    evidenceGate: gate,
    nextAction: "technician-verification",
    verificationRequired: true,
  };
}

module.exports = { evaluateDiagnosticDecision };
