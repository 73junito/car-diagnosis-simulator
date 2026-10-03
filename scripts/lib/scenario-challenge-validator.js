'use strict';

const crypto = require('crypto');

const REQUIRED_DIFFICULTIES = new Set(['intermediate', 'advanced']);

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateGeneratedQuestionItem(item, label = 'Question') {
  if (item.status !== 'draft' ||
      item.support_status !== 'synthetic-draft-pending-evidence' ||
      item.eligible_for_training_mix !== false ||
      item.eligible_for_scoring !== false ||
      item.assessment_eligible !== false) {
    throw new Error(`${label} violates draft governance.`);
  }

  if (!REQUIRED_DIFFICULTIES.has(item.difficulty)) {
    throw new Error(`${label} has invalid difficulty.`);
  }
  if (!nonBlank(item.question)) {
    throw new Error(`${label} is missing a question stem.`);
  }
  if (!nonBlank(item.explanation)) {
    throw new Error(`${label} is missing an explanation.`);
  }
  if (!nonBlank(item.challenge_pattern)) {
    throw new Error(`${label} is missing challenge_pattern.`);
  }

  if (!['A', 'B', 'C', 'D'].includes(item.correct_answer)) {
    throw new Error(`${label} has invalid correct_answer.`);
  }

  const normalizedOptions = [];
  for (const key of ['A', 'B', 'C', 'D']) {
    const value = item.options?.[key];
    if (!nonBlank(value)) {
      throw new Error(`${label} is missing option ${key}.`);
    }
    normalizedOptions.push(value.trim().toLowerCase().replace(/\s+/g, ' '));
  }
  if (new Set(normalizedOptions).size !== 4) {
    throw new Error(`${label} repeats answer option text.`);
  }

  if (!Array.isArray(item.claims_to_verify) ||
      item.claims_to_verify.length === 0 ||
      item.claims_to_verify.some((claim) => !nonBlank(claim))) {
    throw new Error(`${label} must declare non-blank claims_to_verify.`);
  }
}

function validateGenerated({ doc, plan, batch }) {
  const questions = Array.isArray(doc?.questions) ? doc.questions : [];
  if (questions.length !== batch.target_count) {
    throw new Error(`Expected exactly ${batch.target_count} questions; received ${questions.length}.`);
  }

  const counts = Object.fromEntries(plan.scenario_banks.map((id) => [id, 0]));
  const stems = new Set();

  for (const [index, item] of questions.entries()) {
    const label = `Question ${index + 1}`;

    if (!plan.scenario_banks.includes(item?.scenario_id)) {
      throw new Error(`${label} has invalid scenario_id.`);
    }
    counts[item.scenario_id] += 1;

    validateGeneratedQuestionItem(item, label);

    const stem = item.question.trim().toLowerCase().replace(/\s+/g, ' ');
    if (stem.length < 15 || stems.has(stem)) {
      throw new Error(`${label} has an invalid or duplicate stem.`);
    }
    stems.add(stem);
  }

  for (const [scenarioId, expected] of Object.entries(batch.allocation)) {
    if (counts[scenarioId] !== expected) {
      throw new Error(`Scenario ${scenarioId} expected ${expected} questions; received ${counts[scenarioId]}.`);
    }
  }

  return questions.map((item) => ({
    ...item,
    synthetic_draft_id: `${item.scenario_id}-challenge-${crypto.createHash('sha256').update(item.question).digest('hex').slice(0, 12)}`,
    human_technical_review_completed: false,
    human_instructional_review_completed: false,
    evidence_mapping_completed: false,
    citation_validation_completed: false,
    approved: false
  }));
}

module.exports = { validateGenerated, validateGeneratedQuestionItem };
