"use strict";

const fs = require("fs");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const policy = readJson("data/curriculum/content-policy.json");
const lessons = readJson("data/curriculum/lesson-plans.json").lessonPlans;
const plans = readJson("data/curriculum/lesson-content.json").lessonContentPlans;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const purposes = new Set(policy.instructionalPurposes);
const visualTypes = new Map(policy.visualTypes.map((item) => [item.type, item]));
const lessonsById = new Map(lessons.map((item) => [item.id, item]));
const plansByLesson = new Map(plans.map((item) => [item.lessonPlanId, item]));

assert(policy.schemaVersion === "1.0.0", "Unsupported content policy schemaVersion");
assert(policy.coreRules.length >= 20, "Content policy must contain the full core rule set");
assert(policy.visualTypes.length === 7, "Content policy must define exactly seven visual types");
assert(policy.lessonStructure.length >= 10, "Canonical lesson structure is incomplete");
assert(plans.length === lessons.length, "Every lesson plan must have exactly one content plan");
for (const lesson of lessons) {
  const plan = plansByLesson.get(lesson.id);
  assert(plan, `Missing content plan for ${lesson.id}`);
  assert(plan.status === lesson.status, `Status mismatch for ${lesson.id}`);
  assert(Array.isArray(plan.learningObjectives) && plan.learningObjectives.length > 0,
    `Learning objectives missing for ${lesson.id}`);

  const objectiveIds = new Set();
  for (const objective of plan.learningObjectives) {
    assert(objective.id && objective.statement && objective.cognitiveLevel,
      `Incomplete learning objective in ${lesson.id}`);
    assert(!objectiveIds.has(objective.id), `Duplicate objective ${objective.id}`);
    objectiveIds.add(objective.id);
  }

  assert(Array.isArray(plan.structure), `Structure missing for ${lesson.id}`);
  const expectedStructure = JSON.stringify(policy.lessonStructure);
  assert(JSON.stringify(plan.structure) === expectedStructure ||
    (Array.isArray(plan.structureExceptions) && plan.structureExceptions.length > 0),
    `Lesson ${lesson.id} must use canonical structure or document an exception`);
  assert(Array.isArray(plan.contentBlocks) && plan.contentBlocks.length > 0,
    `Content blocks missing for ${lesson.id}`);
  for (const block of plan.contentBlocks) {
    assert(block.id && block.type, `Content block identity missing in ${lesson.id}`);
    assert(purposes.has(block.instructionalPurpose),
      `Unknown instructional purpose ${block.instructionalPurpose} in ${lesson.id}`);
    assert(Array.isArray(block.supportsObjectiveIds) && block.supportsObjectiveIds.length > 0,
      `Content block ${block.id} must map to a learning objective`);
    for (const objectiveId of block.supportsObjectiveIds) {
      assert(objectiveIds.has(objectiveId),
        `Content block ${block.id} references unknown objective ${objectiveId}`);
    }
  }

  assert(Array.isArray(plan.visuals) && plan.visuals.length > 0,
    `At least one purposeful visual is required for ${lesson.id}`);
  for (const visual of plan.visuals) {
    const visualPolicy = visualTypes.get(visual.type);
    assert(visualPolicy, `Unsupported visual type ${visual.type} in ${lesson.id}`);
    assert(purposes.has(visual.instructionalPurpose),
      `Unknown visual purpose ${visual.instructionalPurpose} in ${lesson.id}`);
    assert(Array.isArray(visual.supportsObjectiveIds) && visual.supportsObjectiveIds.length > 0,
      `Visual ${visual.id} must map to a learning objective`);
    for (const objectiveId of visual.supportsObjectiveIds) {
      assert(objectiveIds.has(objectiveId),
        `Visual ${visual.id} references unknown objective ${objectiveId}`);
    }
    assert(visual.accessibilityTextRequired === true,
      `Visual ${visual.id} must require an equivalent text description`);
    if (visualPolicy.requiresWholePartRationale) {
      assert(typeof visual.wholePartRationale === "string" && visual.wholePartRationale.trim().length > 0,
        `Pie chart ${visual.id} requires a whole-part rationale`);
    }
  }

  assert(typeof plan.evidenceExpectation === "string" && plan.evidenceExpectation.length > 20,
    `Evidence expectation missing for ${lesson.id}`);
  assert(typeof plan.assessmentBoundary === "string" && plan.assessmentBoundary.length > 20,
    `Assessment boundary missing for ${lesson.id}`);
}

for (const plan of plans) {
  assert(lessonsById.has(plan.lessonPlanId), `Orphan content plan ${plan.lessonPlanId}`);
}

console.log(
  `[PASS] Curriculum content policy verified: ${policy.coreRules.length} rules, ` +
  `${policy.visualTypes.length} visual types, ${plans.length} lesson content plans`
);
