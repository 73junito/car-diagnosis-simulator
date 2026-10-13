"use strict";

const { createDiagnosticSession, createDiagnosticDecision } = require("./contracts");
const { evaluateEvidenceGate } = require("./evidence-gate");
const { evaluateDiagnosticDecision } = require("./diagnostic-engine");
const { getResponsePolicy } = require("./mode-policy");

const COPILOT_INTENTS = Object.freeze([
  "plan-next-check",
  "evaluate-proposed-decision",
  "prepare-report"
]);

const COPILOT_STATUSES = Object.freeze([
  "needs-input",
  "needs-evidence",
  "ready-for-hypothesis",
  "ready-for-technician-verification"
]);

function normalizeIntent(value) {
  const intent = String(value || "plan-next-check").trim();
  if (!COPILOT_INTENTS.includes(intent)) {
    throw new Error("Unsupported diagnostic copilot intent");
  }
  return intent;
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function missingSessionInputs(session) {
  const missing = [];
  if (!session.complaint && session.symptoms.length === 0) {
    missing.push("vehicle concern or symptom");
  }
  if (
    session.vehicle.match === "unknown" &&
    !session.vehicle.year &&
    !session.vehicle.make &&
    !session.vehicle.model
  ) {
    missing.push("vehicle identity context");
  }
  return missing;
}

function evidenceNextActions(gate) {
  const actions = [];
  for (const reason of gate.reasons || []) {
    if (/No evidence supplied/i.test(reason)) {
      actions.push("Collect approved evidence relevant to the reported concern.");
    } else if (/not approved/i.test(reason)) {
      actions.push("Replace unapproved material with rights-reviewed approved evidence.");
    } else if (/not directly relevant/i.test(reason)) {
      actions.push("Collect evidence that directly addresses the current hypothesis or measurement.");
    } else if (/not current enough/i.test(reason)) {
      actions.push("Verify the claim against a current authoritative source.");
    } else if (/primary authoritative source/i.test(reason)) {
      actions.push("Obtain primary authoritative evidence before making a vehicle-specific claim.");
    } else if (/vehicle identity/i.test(reason) || /does not match the resolved vehicle/i.test(reason)) {
      actions.push("Resolve vehicle identity and applicability before using vehicle-specific procedures.");
    } else {
      actions.push("Collect additional approved evidence before advancing the diagnosis.");
    }
  }
  return uniqueStrings(actions);
}

function createBoundary(mode) {
  const policy = getResponsePolicy(mode);
  return Object.freeze({
    advisoryOnly: true,
    mayGrade: false,
    mayApprove: false,
    mayRelease: false,
    mayPublish: false,
    mayChangeAssessmentEligibility: false,
    verificationRequired: true,
    responseStyle: policy.responseStyle,
    hintsAllowed: policy.allowHints,
    guidedQuestionsAllowed: policy.allowGuidedQuestions
  });
}

function planDiagnosticCopilot({
  intent = "plan-next-check",
  session: sessionInput,
  evidence = [],
  decision: decisionInput = null
} = {}) {
  normalizeIntent(intent);
  const session = createDiagnosticSession(sessionInput || {});
  const boundary = createBoundary(session.mode);
  const missingInputs = missingSessionInputs(session);

  if (missingInputs.length) {
    return {
      status: "needs-input",
      intent,
      sessionId: session.sessionId,
      nextActions: missingInputs.map((item) => "Provide " + item + "."),
      evidenceGate: { allowed: false, status: "insufficient", reasons: ["Required session context is incomplete"] },
      decision: null,
      boundary
    };
  }

  const evidenceGate = evaluateEvidenceGate({ evidence, vehicle: session.vehicle });

  if (!evidenceGate.allowed) {
    return {
      status: "needs-evidence",
      intent,
      sessionId: session.sessionId,
      nextActions: evidenceNextActions(evidenceGate),
      evidenceGate,
      decision: null,
      boundary
    };
  }

  if (!decisionInput) {
    return {
      status: "ready-for-hypothesis",
      intent,
      sessionId: session.sessionId,
      nextActions: [
        "Form a bounded hypothesis that is directly supported by the approved evidence.",
        "Choose the next discriminating check; do not replace technician verification."
      ],
      evidenceGate,
      decision: null,
      boundary
    };
  }

  const decision = createDiagnosticDecision(decisionInput);
  const evaluated = evaluateDiagnosticDecision({ session, decision, evidence });

  return {
    status: evaluated.status,
    intent,
    sessionId: session.sessionId,
    nextActions: evaluated.nextAction ? [evaluated.nextAction] : [],
    evidenceGate: evaluated.evidenceGate,
    decision: evaluated.decision,
    boundary
  };
}

function prepareDiagnosticReport({ session: sessionInput, evidence = [], decision = null } = {}) {
  const plan = planDiagnosticCopilot({
    intent: "prepare-report",
    session: sessionInput,
    evidence,
    decision
  });

  return {
    reportType: "diagnostic-copilot-advisory",
    sessionId: plan.sessionId,
    status: plan.status,
    summary:
      plan.status === "ready-for-technician-verification"
        ? "Evidence supports the proposed diagnostic direction; technician verification remains required."
        : plan.status === "ready-for-hypothesis"
          ? "Approved evidence is available, but no diagnostic decision has been supplied."
          : plan.status === "needs-evidence"
            ? "The diagnostic direction is blocked until the evidence gap is resolved."
            : "The diagnostic direction is blocked until required session context is supplied.",
    nextActions: plan.nextActions,
    evidenceGate: plan.evidenceGate,
    proposedDecision: plan.decision,
    boundary: plan.boundary
  };
}

module.exports = {
  COPILOT_INTENTS,
  COPILOT_STATUSES,
  planDiagnosticCopilot,
  prepareDiagnosticReport
};
