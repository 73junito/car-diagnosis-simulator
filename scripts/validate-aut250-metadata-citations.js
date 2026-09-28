#!/usr/bin/env node
/**
 * AUT-250 Metadata Citation Preflight Validator
 *
 * This validator is intentionally separate from citation-validator-1.0.
 * It validates metadata/link-only citation evidence without claiming:
 * - source excerpt verification,
 * - source text hash verification,
 * - rights clearance,
 * - human technical/instructional/safety approval,
 * - question approval or assessment eligibility.
 *
 * Exit codes:
 *   0 = deterministic metadata/linkage checks pass
 *   1 = one or more checks fail
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REVIEW_PATH = path.join(ROOT, 'data', 'evidence', 'review-queues', 'aut250-training-question-bulk-review-20260927.json');
const HUMAN_PATH = path.join(ROOT, 'data', 'evidence', 'review-queues', 'aut250-human-review-package-20260927.json');
const CURRICULUM_PATH = path.join(ROOT, 'data', 'curriculum', 'lesson-content.json');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isDoi(value) {
  return typeof value === 'string' && /^10\.\d{4,9}\/.+$/i.test(value.trim());
}

function validate() {
  const review = loadJson(REVIEW_PATH);
  const human = loadJson(HUMAN_PATH);
  const curriculum = loadJson(CURRICULUM_PATH);
  const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
  const questions = (plan?.courseModules || []).flatMap((module) => module.trainingQuestions || []);
  const questionIds = new Set(questions.map((q) => q.id));
  const sourceMap = new Map((review.candidate_sources || []).map((source) => [source.id, source]));
  const errors = [];

  if (questions.length !== 20) errors.push(`Expected 20 AUT-250 training questions, found ${questions.length}`);
  if ((review.questions || []).length !== 20) errors.push(`Expected 20 reviewed question mappings, found ${review.questions?.length || 0}`);

  for (const item of review.questions || []) {
    if (!questionIds.has(item.question_id)) {
      errors.push(`Review references unknown question: ${item.question_id}`);
    }
    if (item.disposition !== 'candidate-supported') {
      errors.push(`Question is not candidate-supported: ${item.question_id}`);
    }
    if (!Array.isArray(item.candidate_source_ids) || item.candidate_source_ids.length === 0) {
      errors.push(`Question has no candidate source IDs: ${item.question_id}`);
      continue;
    }
    for (const sourceId of item.candidate_source_ids) {
      const source = sourceMap.get(sourceId);
      if (!source) {
        errors.push(`Question ${item.question_id} references missing source ${sourceId}`);
        continue;
      }
      if (source.ingestion_status !== 'metadata-and-link-only') {
        errors.push(`Source ${sourceId} is not metadata-and-link-only`);
      }
      if (!isHttpsUrl(source.url)) {
        errors.push(`Source ${sourceId} does not have a valid HTTPS URL`);
      }
      if (source.doi && !isDoi(source.doi)) {
        errors.push(`Source ${sourceId} has invalid DOI syntax`);
      }
      if (!source.title || !source.publisher || !source.authority) {
        errors.push(`Source ${sourceId} is missing required bibliographic/authority metadata`);
      }
    }
  }

  const roles = ['rights', 'technical', 'instructional', 'safety'];
  const completedRoles = [];
  for (const role of roles) {
    const r = human.reviewer_requirements?.[role];
    const checklistComplete = r && Object.values(r.checklist || {}).every(Boolean);
    const identityComplete = Boolean(r?.reviewer_name && r?.reviewer_id && r?.qualification_reference && r?.reviewed_at);
    const decisionComplete = r && ['pass', 'pass-with-limitations'].includes(r.decision);
    if (checklistComplete && identityComplete && decisionComplete) completedRoles.push(role);
  }

  const result = {
    validator_version: 'aut250-metadata-citation-preflight-1.0',
    validation_method: 'deterministic-metadata-linkage-and-human-gate-preflight',
    question_count: questions.length,
    reviewed_question_count: (review.questions || []).length,
    candidate_source_count: sourceMap.size,
    metadata_linkage_verified: errors.length === 0,
    human_review_roles_complete: completedRoles,
    human_review_complete: completedRoles.length === roles.length,
    rights_clearance_claimed: false,
    excerpt_verification_claimed: false,
    source_hash_verification_claimed: false,
    production_citation_validation_written: false,
    question_approval_effect: 'none',
    assessment_eligibility_effect: 'none',
    result: errors.length === 0 ? 'preflight-valid' : 'preflight-invalid',
    errors
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

const result = validate();
process.exit(result.result === 'preflight-valid' ? 0 : 1);
