'use strict';

const fs = require('fs');
const path = require('path');
const { AGENT_VERSION, selectDrafts } = require('./agents/aut250-question-expansion-agent');
const { runAut250OllamaWorker } = require('./workers/ollama-aut250-question-worker');

const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const model = args.model || 'gpt-oss:20b';
const targetCount = Number(args.target || 20);
const curriculumPath = path.resolve(root, args.curriculum || 'data/curriculum/lesson-content.json');
const approvalPaths = [
  path.resolve(root, args.approval1 || 'data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json'),
  path.resolve(root, args.approval2 || 'data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json')
];
const outputPath = path.resolve(root, args.output || 'aut250-question-drafts.json');
const apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';
const apiKey = process.env.OLLAMA_API_KEY || '';
const dryRun = args['dry-run'] === 'true';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 20) {
  fail('--target must be an integer from 1 through 20.');
}
if (!dryRun && !apiKey) fail('OLLAMA_API_KEY is required unless --dry-run=true.');

const curriculum = JSON.parse(fs.readFileSync(curriculumPath, 'utf8'));
const approvals = approvalPaths.map((approvalPath) => JSON.parse(fs.readFileSync(approvalPath, 'utf8')));
const plan = (curriculum.lessonContentPlans || []).find((item) => item.lessonPlanId === 'ug-hev-foundations');

if (!plan) fail('AUT-250 lesson plan ug-hev-foundations was not found.');
if ((plan.courseModules || []).length !== 6) fail('AUT-250 must contain exactly six course modules.');

const retainedQuestions = (plan.courseModules || []).flatMap((module) => module.trainingQuestions || []);
if (retainedQuestions.length !== 40) fail(`Expected 40 retained approved questions; found ${retainedQuestions.length}.`);

const expectedApprovals = [
  { batch: 'aut250-training-batch-001', count: 20 },
  { batch: 'aut250-training-batch-002-ollama-repaired', count: 20 }
];

const approvalReady = ({ batch, count }) => {
  const approval = approvals.find((item) => item.question_batch === batch);
  const effect = approval?.approval_effect_if_confirmed || {};
  const release = approval?.release_state || {};
  const prerequisites = approval?.prerequisite_state || {};
  return [
    approval?.course_id === 'AUT-250',
    approval?.lesson_plan_id === 'ug-hev-foundations',
    approval?.question_batch === batch,
    approval?.question_count === count,
    approval?.requested_final_decision?.decision === 'approved',
    release.training_bank_final_approval === 'approved-for-training-use',
    prerequisites.human_reviews_complete === true,
    prerequisites.citation_representation === 'metadata-only-citation-proof',
    prerequisites.deterministic_metadata_validation === 'valid',
    prerequisites.deterministic_questions_valid === count,
    prerequisites.deterministic_questions_invalid === 0,
    effect.training_delivery_allowed === true,
    effect.scored === false,
    effect.high_stakes_eligible === false,
    effect.institutional_assessment_eligible === false,
    effect.production_assessment_api_eligible === false
  ].every(Boolean);
};

const governanceReady = expectedApprovals.every(approvalReady);
if (!governanceReady) fail('AUT-250 final approval and deterministic validation prerequisites are not satisfied.');

const moduleSummary = (plan.courseModules || []).map((module) => ({
  module_id: module.id,
  title: module.title,
  question_count: (module.trainingQuestions || []).length,
  objective_count: (module.moduleObjectives || []).length,
  safety_boundary_present: Boolean(module.safetyAndEvidenceBoundary)
}));

if (dryRun) {
  process.stdout.write(JSON.stringify({
    course_id: 'AUT-250',
    lesson_plan_id: 'ug-hev-foundations',
    model,
    target_count: targetCount,
    retained_question_count: retainedQuestions.length,
    module_count: plan.courseModules.length,
    modules: moduleSummary,
    governance: {
      approved_training_bank: true,
      approved_training_batches: 2,
      human_reviews_complete: true,
      deterministic_metadata_validation: 'valid',
      citation_representation: 'metadata-only-citation-proof',
      third_party_source_text_sent_to_model: false,
      auto_approval: false
    },
    agent_version: AGENT_VERSION
  }, null, 2) + '\n');
  process.exit(0);
}

(async () => {
  const { generated } = await runAut250OllamaWorker({
    apiUrl, apiKey, model, plan, targetCount
  });

  const { questions, skippedDuplicates } = selectDrafts({
    generated, plan, targetCount
  });

  const countsByModule = Object.fromEntries(
    (plan.courseModules || []).map((module) => [
      module.id,
      questions.filter((question) => question.module_id === module.id).length
    ])
  );

  const result = {
    generator: {
      provider: 'ollama-cloud',
      model,
      agent_version: AGENT_VERSION,
      worker: 'ollama-aut250-question-worker',
      generated_at: new Date().toISOString(),
      course_id: 'AUT-250',
      lesson_plan_id: 'ug-hev-foundations',
      requested_count: targetCount,
      returned_count: questions.length,
      skipped_duplicate_count: skippedDuplicates.length
    },
    governance: {
      source_context: 'project-authored-curriculum-only',
      third_party_source_text_sent_to_model: false,
      metadata_only_evidence_method_preserved: true,
      evidence_mapping_status: 'pending-human-metadata-mapping',
      auto_database_write: false,
      auto_approval: false,
      scored: false,
      high_stakes_eligible: false,
      institutional_assessment_eligible: false,
      production_assessment_api_eligible: false,
      requires_human_rights_review: true,
      requires_human_technical_review: true,
      requires_human_instructional_review: true,
      requires_human_safety_review: true
    },
    retained_question_count: retainedQuestions.length,
    counts_by_module: countsByModule,
    questions,
    skipped_duplicates: skippedDuplicates
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${questions.length} AUT-250 draft questions to ${outputPath}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
