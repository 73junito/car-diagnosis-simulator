'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const {
  validateNativeDraftArtifact,
  buildScenarioQuestionRow,
  buildDraftProvenanceRow,
  assertExactExistingQuestion,
  assertDraftProvenance,
} = require('../src/ai/runtime/native-question-draft');

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const scenarioId = args.scenario || '';
const runId = args['run-id'] || '';
const artifactPath = path.resolve(args.artifact || '');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(scenarioId)) fail('A valid --scenario is required.');
if (!/^[A-Za-z0-9._:-]+$/.test(runId)) fail('A valid --run-id is required.');
if (!args.artifact || !fs.existsSync(artifactPath)) fail('A readable --artifact file is required.');

(async () => {
  const document = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const question = validateNativeDraftArtifact(document, { scenarioId });
  const expectedQuestion = buildScenarioQuestionRow(question);
  const expectedProvenance = buildDraftProvenanceRow(question.question_id);

  const workerId = [
    'github-actions',
    process.env.GITHUB_RUN_ID || 'local',
    process.env.GITHUB_RUN_ATTEMPT || '1',
    'native-draft-ingest',
  ].join(':');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId,
  });

  if (!runtime.persistence.enabled || !runtime.governanceRuntime) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let { data: storedQuestion, error: existingQuestionError } = await client
    .from('scenario_questions')
    .select('id,scenario_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,created_at')
    .eq('question_id', question.question_id)
    .maybeSingle();
  if (existingQuestionError) throw existingQuestionError;

  if (!storedQuestion) {
    const { data: duplicateText, error: duplicateTextError } = await client
      .from('scenario_questions')
      .select('id,question_id')
      .eq('scenario_id', scenarioId)
      .eq('question_text', expectedQuestion.question_text)
      .maybeSingle();
    if (duplicateTextError) throw duplicateTextError;
    if (duplicateText) {
      throw new Error('A different question already uses the same scenario/question text.');
    }

    const { data: insertedQuestion, error: insertQuestionError } = await client
      .from('scenario_questions')
      .insert(expectedQuestion)
      .select('id,scenario_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,created_at')
      .single();
    if (insertQuestionError) throw insertQuestionError;
    storedQuestion = insertedQuestion;
  } else {
    assertExactExistingQuestion(storedQuestion, expectedQuestion);
  }

  let { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;

  if (!provenance) {
    const { data: insertedProvenance, error: insertProvenanceError } = await client
      .from('question_provenance')
      .insert(expectedProvenance)
      .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
      .single();
    if (insertProvenanceError) throw insertProvenanceError;
    provenance = insertedProvenance;
  } else {
    assertDraftProvenance(provenance, question.question_id);
  }

  assertDraftProvenance(provenance, question.question_id);

  const { count: citationCount, error: citationCountError } = await client
    .from('question_citations')
    .select('id', { count: 'exact', head: true })
    .eq('question_provenance_id', provenance.id);
  if (citationCountError) throw citationCountError;
  if (citationCount !== 0) {
    throw new Error('Native drafted state must not already contain persisted question citations.');
  }

  const { count: eligibilityCount, error: eligibilityError } = await client
    .from('assessment_question_eligibility')
    .select('question_id', { count: 'exact', head: true })
    .eq('question_id', storedQuestion.id);
  if (eligibilityError) throw eligibilityError;
  if (eligibilityCount !== 0) {
    throw new Error('Native draft unexpectedly has assessment eligibility.');
  }

  await runtime.governanceRuntime.initializeDraft({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    createdAt: storedQuestion.created_at,
    initializationEvidence: `question_provenance:${provenance.id}`,
  });

  const entries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);

  if (
    entries.length !== 1 ||
    entries[0].action !== 'draft-initialized' ||
    entries[0].state !== 'drafted' ||
    checkpoint?.state !== 'drafted' ||
    checkpoint?.version !== 1 ||
    checkpoint?.metadata?.humanApproval !== false
  ) {
    throw new Error('Native draft orchestration verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    integrityHash: checkpoint.integrityHash,
    citationsPersisted: 0,
    assessmentEligibilityRows: 0,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
