"use strict";

const {
  planDiagnosticCopilot,
  prepareDiagnosticReport
} = require("./diagnostic-copilot");

function createDiagnosticCopilotAgent() {
  return {
    id: "diagnostic-copilot-agent",
    name: "Automotive Diagnostic Copilot",
    capabilities: [
      "diagnostic-plan-preparation",
      "diagnostic-report-preparation"
    ],
    defaultPriority: 2,
    mayPrepare: true,
    mayHumanApprove: false,
    mayRelease: false,
    async execute({ input = {}, context = {}, process } = {}) {
      const capability = process && process.capability;

      if (capability === "diagnostic-plan-preparation") {
        return planDiagnosticCopilot(input);
      }
      if (capability === "diagnostic-report-preparation") {
        return prepareDiagnosticReport(input);
      }

      throw new Error("Unsupported diagnostic copilot capability");
    }
  };
}

module.exports = { createDiagnosticCopilotAgent };
