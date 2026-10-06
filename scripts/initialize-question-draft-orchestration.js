'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const questionId = args['question-id'] || '';
const runId = args['run-id'] || '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(questionId)) fail('A valid --question-id is required.');
if (!/^[A-Za-z0-9._:-]+$/.test(runId)) fail('A valid --run-id is required.');

(async () => {
  const workerId = [
    'github-actions',
    process.env.GITHUB_RUN_ID || 'local',
    process.env.GITHUB_RUN_ATTEMPT || '1',
    'draft-initializer',
  ].join(':');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId,
  });

  if (!runtime.persistence.enabled || !runtime.governanceRuntime) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

  const existingRun = await runtime.governanceRuntime.getRun(runId);
  if (existingRun.length) {
    const matching = existingRun.find((entry) =>
      entry.action === 'draft-initialized' &&
      entry.state === 'drafted' &&
      entry.metadata?.questionId === questionId
    );
    if (matching) {
      console.log(JSON.stringify({
        runId,
        questionId,
        state: matching.state,
        version: matching.version,
        idempotent: true,
      }));
      return;
    }
    throw new Error('Target governed run is not empty.');
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: question, error: questionError } = await client
    .from('scenario_questions')
    .select('id,question_id,scenario_id,created_at')
    .eq('question_id', questionId)
    .maybeSingle();
  if (questionError) throw questionError;
  if (!question) throw new Error('Question was not found in production.');
  if (question.question_id !== questionId) throw new Error('Question semantic ID mismatch.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,status,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('question_id', questionId)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  if (!provenance) throw new Error('Draft question provenance was not found in production.');
  if (provenance.question_id !== questionId) throw new Error('Question provenance semantic ID mismatch.');
  if (provenance.status !== 'draft') throw new Error('Question provenance is not draft.');
  if (
    provenance.technical_reviewer_id ||
    provenance.technical_reviewed_at ||
    provenance.instructional_reviewer_id ||
    provenance.instructional_reviewed_at ||
    provenance.approved_by ||
    provenance.approved_at
  ) {
    throw new Error('Draft provenance already contains review or approval evidence.');
  }

  const createdAt = question.created_at;
  if (!createdAt) throw new Error('Draft creation timestamp is missing.');

  const entry = await runtime.governanceRuntime.initializeDraft({
    runId,
    provenanceId: provenance.id,
    questionId,
    createdAt,
    initializationEvidence: `question_provenance:${provenance.id}`,
  });

  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  if (
    entry.state !== 'drafted' ||
    checkpoint?.state !== 'drafted' ||
    checkpoint?.action !== 'draft-initialized' ||
    checkpoint?.version !== 1 ||
    checkpoint?.metadata?.humanApproval !== false
  ) {
    throw new Error('Draft orchestration initialization verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId,
    provenanceId: provenance.id,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    integrityHash: checkpoint.integrityHash,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
