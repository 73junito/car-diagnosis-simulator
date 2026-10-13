"use strict";

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function prepareInstructorIntelligence({
  classId,
  totalStudents = 0,
  students = [],
  sessions = {}
} = {}) {
  const anonymized = Array.isArray(students)
    ? students.map((row, index) => ({
        learnerRef: `learner-${index + 1}`,
        sessions: finite(row.sessions),
        completedSessions: finite(row.completedSessions),
        averageScore: finite(row.averageScore),
        answerAccuracy: finite(row.answerAccuracy)
      }))
    : [];

  const lowCompletion = anonymized.filter((row) =>
    row.sessions !== null &&
    row.sessions > 0 &&
    (row.completedSessions || 0) / row.sessions < 0.5
  ).length;

  const lowAccuracy = anonymized.filter((row) =>
    row.answerAccuracy !== null && row.answerAccuracy < 70
  ).length;

  const signals = [];
  if (lowCompletion) signals.push(`${lowCompletion} learner(s) show low completion.`);
  if (lowAccuracy) signals.push(`${lowAccuracy} learner(s) show training accuracy below 70%.`);
  if (!signals.length) signals.push("No aggregate training attention signal was detected.");

  return {
    classId: classId || null,
    totalStudents: Number(totalStudents) || anonymized.length,
    aggregate: {
      totalSessions: finite(sessions.totalSessions),
      completedSessions: finite(sessions.completedSessions),
      completionRate: finite(sessions.completionRate),
      averageScore: finite(sessions.averageScore),
      averageTime: finite(sessions.averageTime)
    },
    signals,
    boundary: {
      preparationOnly: true,
      readOnly: true,
      learnerIdentityExcluded: true,
      mayGrade: false,
      mayChangeEligibility: false,
      mayRelease: false
    }
  };
}

function createInstructorIntelligenceAgent() {
  return {
    id: "instructor-intelligence-agent",
    name: "Instructor Intelligence Agent",
    capabilities: ["instructor-training-summary-preparation"],
    defaultPriority: 1,
    mayPrepare: true,
    mayHumanApprove: false,
    mayRelease: false,
    async execute({ input = {}, process } = {}) {
      if (process?.capability !== "instructor-training-summary-preparation") {
        throw new Error("Unsupported instructor intelligence capability");
      }
      return prepareInstructorIntelligence(input);
    }
  };
}

module.exports = {
  prepareInstructorIntelligence,
  createInstructorIntelligenceAgent
};
