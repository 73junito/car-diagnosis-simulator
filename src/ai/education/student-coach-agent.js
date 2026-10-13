"use strict";

function cleanRows(rows) {
  return Array.isArray(rows)
    ? rows.slice(0, 5).map((row) => ({
        scenarioId: String(row.scenario_id || row.scenarioId || "").trim(),
        reason: String(row.reason || "").trim().slice(0, 500),
        action: String(row.action || "practice").trim()
      })).filter((row) => row.scenarioId)
    : [];
}

function prepareStudentCoachSummary({ recommendations = [], state = "available" } = {}) {
  const rows = cleanRows(recommendations);
  return {
    status: rows.length ? "available" : "insufficient-history",
    sourceState: state,
    summary: rows.length
      ? "Practice priorities were prepared from server-recorded training recommendations."
      : "More training history is needed before a practice priority can be prepared.",
    priorities: rows,
    boundary: {
      preparationOnly: true,
      assessmentDataUsed: false,
      mayGrade: false,
      mayChangeEligibility: false,
      mayRelease: false
    }
  };
}

function createStudentCoachAgent() {
  return {
    id: "student-coach-agent",
    name: "Student Coach Agent",
    capabilities: ["student-practice-summary-preparation"],
    defaultPriority: 1,
    mayPrepare: true,
    mayHumanApprove: false,
    mayRelease: false,
    async execute({ input = {}, process } = {}) {
      if (process?.capability !== "student-practice-summary-preparation") {
        throw new Error("Unsupported student coach capability");
      }
      return prepareStudentCoachSummary(input);
    }
  };
}

module.exports = {
  prepareStudentCoachSummary,
  createStudentCoachAgent
};
