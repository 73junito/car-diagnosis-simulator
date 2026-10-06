'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const {
  validateNativeDraftArtifact,
  buildPrivateDraftRow,
  buildDraftProvenanceRow,
  assertExactExistingPrivateDraft,
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
  const payloadText = fs.readFileSync(artifactPath, 'utf8');
  const document = JSON.parse(payloadText);
  const question = validateNativeDraftArtifact(document, { scenarioId });

  const workflowRunId = Number(process.env.GITHUB_RUN_ID || 0);
  const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0);
  const sourceCommit = String(process.env.GITHUB_SHA || '').trim();

  const expectedPrivateDraft = buildPrivateDraftRow(document, question, {
    governedRunId: runId,
    workflowRunId,
    workflowRunAttempt,
    sourceCommit,
    payloadText,
  });

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

  const selectPrivate = 'id,governed_run_id,question_id,scenario_id,workflow_run_id,workflow_run_attempt,source_commit,provider,model,agent_version,payload_sha256,status,payload_text,created_at';

  let { data: privateDraft, error: privateDraftError } = await client
    .from('native_governed_question_drafts')
    .select(selectPrivate)
    .eq('governed_run_id', runId)
    .maybeSingle();
  if (privateDraftError) throw privateDraftError;

  if (!privateDraft) {
    const { data: questionCollision, error: questionCollisionError } = await client
      .from('native_governed_question_drafts')
      .select(selectPrivate)
      .eq('question_id', question.question_id)
      .maybeSingle();
    if (questionCollisionError) throw questionCollisionError;

    if (questionCollision) {
      assertExactExistingPrivateDraft(questionCollision, expectedPrivateDraft);
      privateDraft = questionCollision;
    } else {
      const { data: insertedDraft, error: insertDraftError } = await client
        .from('native_governed_question_drafts')
        .insert(expectedPrivateDraft)
        .select(selectPrivate)
        .single();
      if (insertDraftError) throw insertDraftError;
      privateDraft = insertedDraft;
    }
  } else {
    assertExactExistingPrivateDraft(privateDraft, expectedPrivateDraft);
  }

  let { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;

  if (!provenance) {
    const expectedProvenance = buildDraftProvenanceRow(question.question_id, {
      privateDraftId: privateDraft.id,
      payloadSha256: privateDraft.payload_sha256,
      agentVersion: privateDraft.agent_version,
    });
    const { data: insertedProvenance, error: insertProvenanceError } = await client
      .from('question_provenance')
      .insert(expectedProvenance)
      .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
      .single();
    if (insertProvenanceError) throw insertProvenanceError;
    provenance = insertedProvenance;
  }

  assertDraftProvenance(provenance, question.question_id, {
    privateDraftId: privateDraft.id,
    payloadSha256: privateDraft.payload_sha256,
  });

  const { count: publicQuestionCount, error: publicQuestionError } = await client
    .from('scenario_questions')
    .select('id', { count: 'exact', head: true })
    .eq('question_id', question.question_id);
  if (publicQuestionError) throw publicQuestionError;
  if (publicQuestionCount !== 0) {
    throw new Error('Native draft must not be promoted into public scenario_questions.');
  }

  const { count: citationCount, error: citationCountError } = await client
    .from('question_citations')
    .select('id', { count: 'exact', head: true })
    .eq('question_provenance_id', provenance.id);
  if (citationCountError) throw citationCountError;
  if (citationCount !== 0) {
    throw new Error('Native drafted state must not already contain persisted question citations.');
  }

  const existingRun = await runtime.governanceRuntime.getRun(runId);
  if (!existingRun.length) {
    await runtime.governanceRuntime.initializeDraft({
      runId,
      provenanceId: provenance.id,
      questionId: question.question_id,
      createdAt: privateDraft.created_at,
      initializationEvidence: `native_governed_question_drafts:${privateDraft.id}`,
    });
  }

  const entries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);

  if (
    entries.length !== 1 ||
    entries[0].action !== 'draft-initialized' ||
    entries[0].state !== 'drafted' ||
    entries[0].metadata?.questionId !== question.question_id ||
    entries[0].metadata?.provenanceId !== provenance.id ||
    checkpoint?.state !== 'drafted' ||
    checkpoint?.version !== 1 ||
    checkpoint?.metadata?.humanApproval !== false
  ) {
    throw new Error('Native draft orchestration verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    privateDraftId: privateDraft.id,
    provenanceId: provenance.id,
    payloadSha256: privateDraft.payload_sha256,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    integrityHash: checkpoint.integrityHash,
    publicScenarioQuestionRows: 0,
    citationsPersisted: 0,
    assessmentEligibilityRows: 0,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
