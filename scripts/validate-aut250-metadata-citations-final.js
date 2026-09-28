#!/usr/bin/env node
/**
 * AUT-250 Deterministic Metadata Citation Validator
 *
 * Final deterministic validation under the approved
 * "metadata-only-citation-proof" representation.
 *
 * This validator intentionally does NOT:
 * - fetch or store source text,
 * - validate copyrighted excerpts,
 * - claim source-text hash verification,
 * - write legacy citation_validations rows,
 * - approve questions or assessment eligibility.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REVIEW_REL = 'data/evidence/review-queues/aut250-training-question-bulk-review-20260927.json';
const HUMAN_REL = 'data/evidence/review-queues/aut250-human-review-package-20260927.json';
const CURRICULUM_REL = 'data/curriculum/lesson-content.json';

const REVIEW_PATH = path.join(ROOT, REVIEW_REL);
const HUMAN_PATH = path.join(ROOT, HUMAN_REL);
const CURRICULUM_PATH = path.join(ROOT, CURRICULUM_REL);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function isHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
function isDoi(value) {
  return typeof value === 'string' && /^10\.\d{4,9}\/.+$/i.test(value.trim());
}
function humanRoleComplete(review) {
  if (!review) return false;
  const checklistComplete = Object.values(review.checklist || {}).every(Boolean);
  const identityComplete = Boolean(
    review.reviewer_name &&
    review.reviewer_id &&
    review.qualification_reference &&
    review.reviewed_at
  );
  const decisionComplete = ['pass', 'pass-with-limitations'].includes(review.decision);
  return checklistComplete && identityComplete && decisionComplete;
}

function validate() {
  const reviewText = read(REVIEW_PATH);
  const humanText = read(HUMAN_PATH);
  const curriculumText = read(CURRICULUM_PATH);
  const review = JSON.parse(reviewText);
  const human = JSON.parse(humanText);
  const curriculum = JSON.parse(curriculumText);

  const errors = [];
  const roles = ['rights', 'technical', 'instructional', 'safety'];
  const completedRoles = roles.filter(function (role) {
    return humanRoleComplete(human.reviewer_requirements && human.reviewer_requirements[role]);
  });

  if (!human.citation_evidence_decision || human.citation_evidence_decision.status !== 'confirmed') {
    errors.push('Citation evidence decision is not confirmed');
  }
  if (!human.citation_evidence_decision ||
      human.citation_evidence_decision.approved_representation !== 'metadata-only-citation-proof') {
    errors.push('Approved citation representation is not metadata-only-citation-proof');
  }
  if (completedRoles.length !== roles.length) {
    errors.push('Human reviews incomplete: ' + completedRoles.length + '/' + roles.length);
  }

  const plan = curriculum.lessonContentPlans.find(function (item) {
    return item.lessonPlanId === 'ug-hev-foundations';
  });
  const questions = (plan && plan.courseModules ? plan.courseModules : []).flatMap(function (module) {
    return module.trainingQuestions || [];
  });
  const questionById = new Map(questions.map(function (q) { return [q.id, q]; }));
  const sourceById = new Map((review.candidate_sources || []).map(function (source) {
    return [source.id, source];
  }));

  if (questions.length !== 20) errors.push('Expected 20 training questions, found ' + questions.length);
  if ((review.questions || []).length !== 20) {
    errors.push('Expected 20 review mappings, found ' + ((review.questions || []).length));
  }

  const questionResults = [];
  for (const mapping of review.questions || []) {
    const qErrors = [];
    const q = questionById.get(mapping.question_id);

    if (!q) qErrors.push('Question not present in canonical curriculum');
    if (mapping.disposition !== 'candidate-supported') qErrors.push('Disposition is not candidate-supported');
    if (!Array.isArray(mapping.candidate_source_ids) || mapping.candidate_source_ids.length === 0) {
      qErrors.push('No candidate sources linked');
    }

    const sources = [];
    for (const sourceId of mapping.candidate_source_ids || []) {
      const source = sourceById.get(sourceId);
      const sourceErrors = [];
      if (!source) {
        sourceErrors.push('Source record missing');
      } else {
        if (!source.title) sourceErrors.push('Missing title');
        if (!source.publisher) sourceErrors.push('Missing publisher');
        if (!source.authority) sourceErrors.push('Missing authority');
        if (!isHttpsUrl(source.url)) sourceErrors.push('URL is not valid HTTPS');
        if (source.doi && !isDoi(source.doi)) sourceErrors.push('DOI syntax invalid');
        if (source.ingestion_status !== 'metadata-and-link-only') {
          sourceErrors.push('Source is not metadata-and-link-only');
        }
      }
      sources.push({
        source_id: sourceId,
        metadata_valid: sourceErrors.length === 0,
        errors: sourceErrors
      });
      qErrors.push.apply(qErrors, sourceErrors.map(function (err) {
        return sourceId + ': ' + err;
      }));
    }

    questionResults.push({
      question_id: mapping.question_id,
      module_id: mapping.module_id,
      support_strength: mapping.support_strength,
      source_ids: mapping.candidate_source_ids || [],
      sources: sources,
      result: qErrors.length === 0 ? 'valid' : 'invalid',
      errors: qErrors
    });
  }

  const validQuestionCount = questionResults.filter(function (q) {
    return q.result === 'valid';
  }).length;
  if (validQuestionCount !== 20) {
    errors.push('Only ' + validQuestionCount + '/20 question mappings validated');
  }

  const inputIntegrity = {};
  inputIntegrity[REVIEW_REL] = sha256(reviewText);
  inputIntegrity[HUMAN_REL] = sha256(humanText);
  inputIntegrity[CURRICULUM_REL] = sha256(curriculumText);

  return {
    validation_id: 'aut250-training-batch-001-metadata-validation-20260927',
    validator_version: 'aut250-metadata-citation-validator-1.0',
    validation_method: 'deterministic-metadata-only-citation-proof',
    scope: {
      course_id: 'AUT-250',
      lesson_plan_id: 'ug-hev-foundations',
      question_batch: 'aut250-training-batch-001',
      expected_question_count: 20
    },
    approved_representation: human.citation_evidence_decision ?
      human.citation_evidence_decision.approved_representation : null,
    input_integrity: inputIntegrity,
    human_review_roles_complete: completedRoles,
    human_review_complete: completedRoles.length === roles.length,
    question_results: questionResults,
    summary: {
      questions_valid: validQuestionCount,
      questions_invalid: questionResults.length - validQuestionCount,
      candidate_sources: sourceById.size,
      metadata_linkage_verified: errors.length === 0,
      deterministic_validation_complete: errors.length === 0
    },
    claims: {
      metadata_identity_and_linkage_verified: errors.length === 0,
      source_excerpt_verified: false,
      source_text_hash_verified: false,
      rights_clearance_claimed: false,
      production_legacy_citation_validation_written: false,
      question_approval_effect: 'none',
      assessment_eligibility_effect: 'none',
      release_effect: 'none'
    },
    result: errors.length === 0 ? 'valid' : 'invalid',
    errors: errors
  };
}

const args = process.argv.slice(2);
const outputArg = args.find(function (arg) { return arg.startsWith('--output='); });
const result = validate();
const json = JSON.stringify(result, null, 2) + '\n';

if (outputArg) {
  const outputPath = path.resolve(ROOT, outputArg.slice('--output='.length));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, 'utf8');
}
process.stdout.write(json);
process.exit(result.result === 'valid' ? 0 : 1);
