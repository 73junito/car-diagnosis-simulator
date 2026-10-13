"use strict";

function text(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value, maxItems, maxLength = 500) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => text(item, maxLength)).filter(Boolean)
    : [];
}

function prepareCurriculumEnhancement({
  lessonPlanId,
  goal,
  draftPayload,
  evidence = []
} = {}) {
  const normalizedLessonPlanId = text(lessonPlanId, 200);
  const normalizedGoal = text(goal, 1000);
  if (!normalizedLessonPlanId) throw new Error("lessonPlanId is required");
  if (normalizedGoal.length < 10) throw new Error("goal must be at least 10 characters");
  if (!draftPayload || typeof draftPayload !== "object") {
    throw new Error("draftPayload is required");
  }

  const summary = text(draftPayload.summary, 2000);
  const rationale = text(draftPayload.rationale, 3000);
  const proposedSteps = stringList(draftPayload.proposed_steps, 12, 800);
  if (!summary || !rationale || proposedSteps.length === 0) {
    throw new Error("draft payload does not satisfy governed curriculum contract");
  }

  const approvedEvidence = Array.isArray(evidence)
    ? evidence.slice(0, 8).map((item) => ({
        evidenceId: text(item.id || item.evidenceId, 240),
        sourceId: text(item.approved_source_id || item.sourceId, 240),
        reviewStatus: text(item.review_status || item.reviewStatus, 80),
        licenseStatus: text(item.license_status || item.licenseStatus, 80),
        scoredAssessmentEligible: item.scored_assessment_eligible === true
      }))
    : [];

  for (const item of approvedEvidence) {
    if (
      !item.evidenceId ||
      !item.sourceId ||
      item.reviewStatus !== "approved" ||
      item.licenseStatus !== "verified-for-use" ||
      item.scoredAssessmentEligible
    ) {
      throw new Error("evidence does not satisfy governed curriculum preparation contract");
    }
  }

  return {
    lessonPlanId: normalizedLessonPlanId,
    goal: normalizedGoal,
    draft: {
      summary,
      rationale,
      proposedObjectives: stringList(draftPayload.proposed_objectives, 8, 600),
      proposedSteps,
      sourceNotes: Array.isArray(draftPayload.source_notes)
        ? draftPayload.source_notes.slice(0, 8).map((item) => ({
            evidenceId: text(item?.evidenceId, 240),
            use: text(item?.use, 700)
          })).filter((item) => item.evidenceId && item.use)
        : [],
      safetyNotes: stringList(draftPayload.safety_notes, 8, 700)
    },
    provenance: {
      evidence: approvedEvidence
    },
    boundary: {
      preparationOnly: true,
      humanReviewRequired: true,
      publicationGranted: false,
      assessmentGenerationAllowed: false,
      scoredAssessmentEligible: false,
      mayApproveEvidence: false,
      mayApproveRights: false,
      mayPublish: false,
      mayRelease: false
    }
  };
}

function createGovernedCurriculumAgent() {
  return {
    id: "governed-curriculum-agent",
    name: "Governed Curriculum Agent",
    capabilities: ["governed-curriculum-enhancement-preparation"],
    defaultPriority: 1,
    mayPrepare: true,
    mayHumanApprove: false,
    mayRelease: false,
    async execute({ input = {}, process } = {}) {
      if (process?.capability !== "governed-curriculum-enhancement-preparation") {
        throw new Error("Unsupported governed curriculum capability");
      }
      return prepareCurriculumEnhancement(input);
    }
  };
}

module.exports = {
  prepareCurriculumEnhancement,
  createGovernedCurriculumAgent
};
