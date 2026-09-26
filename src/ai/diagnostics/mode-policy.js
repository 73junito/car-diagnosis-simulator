"use strict";

function getResponsePolicy(mode) {
  if (mode === "training") {
    return Object.freeze({
      mode,
      allowHints: true,
      allowExplanations: true,
      allowGuidedQuestions: true,
      allowRetry: true,
      responseStyle: "instructional",
      technicianVerificationRequired: true,
    });
  }
  if (mode === "technician") {
    return Object.freeze({
      mode,
      allowHints: false,
      allowExplanations: true,
      allowGuidedQuestions: false,
      allowRetry: false,
      responseStyle: "concise-evidence-first",
      technicianVerificationRequired: true,
    });
  }
  throw new Error("Unsupported diagnostic response mode");
}

module.exports = { getResponsePolicy };
