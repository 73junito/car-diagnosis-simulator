'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionPersistenceRuntime } = require('../src/ai/runtime/production-persistence-runtime');
const { buildApprovedProvenanceBackfill } = require('../src/ai/runtime/approved-provenance-bootstrap');

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
  const persistence = createProductionPersistenceRuntime({
    env: process.env,
    workerId: [
      'github-actions',
      process.env.GITHUB_RUN_ID || 'local',
      process.env.GITHUB_RUN_ATTEMPT || '1',
      'provenance-bootstrap',
    ].join(':'),
  });

  if (!persistence.enabled || !persistence.coordinator) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

  const existingEntries = await persistence.store.loadEntries(runId);
  if (existingEntries.length) {
    throw new Error('Target orchestration run must be empty before provenance bootstrap.');
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const one = async (table, select, column, value) => {
    const { data, error } = await client.from(table).select(select).eq(column, value).maybeSingle();
    if (error) throw error;
    return data;
  };

  const question = await one(
    'scenario_questions',
    'question_id,scenario_id,created_at',
    'question_id',
    questionId
  );
  if (!question) throw new Error('Question was not found in production.');

  const provenance = await one(
    'question_provenance',
    'id,question_id,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes',
    'question_id',
    questionId
  );
  if (!provenance) throw new Error('Question provenance was not found in production.');

  const citationValidation = await one(
    'citation_validations',
    'id,question_provenance_id,validator_version,validation_method,source_hashes_verified,excerpts_verified,urls_verified,result,validated_at',
    'question_provenance_id',
    provenance.id
  );
  if (!citationValidation) throw new Error('Citation validation was not found in production.');

  const { data: citations, error: citationsError } = await client
    .from('question_citations')
    .select('id,question_provenance_id,source_id,chunk_id,role')
    .eq('question_provenance_id', provenance.id);
  if (citationsError) throw citationsError;

  const sourceEvidence = [];
  for (const citation of citations || []) {
    const { data: chunk, error: chunkError } = await client
      .from('source_chunks')
      .select('chunk_id,source_id,status,approved,approved_at')
      .eq('chunk_id', citation.chunk_id)
      .eq('source_id', citation.source_id)
      .maybeSingle();
    if (chunkError) throw chunkError;

    const { data: source, error: sourceError } = await client
      .from('approved_sources')
      .select('id,status,license,license_reviewed_at')
      .eq('id', citation.source_id)
      .maybeSingle();
    if (sourceError) throw sourceError;

    sourceEvidence.push({
      source_id: citation.source_id,
      chunk_id: citation.chunk_id,
      chunk_status: chunk?.status || null,
      chunk_approved: chunk?.approved === true,
      source_status: source?.status || null,
      license: source?.license || null,
      license_reviewed_at: source?.license_reviewed_at || null,
    });
  }

  const entries = buildApprovedProvenanceBackfill({
    runId,
    question,
    provenance,
    citationValidation,
    citations: citations || [],
    sourceEvidence,
  });

  for (const entry of entries) {
    await persistence.coordinator.append(entry);
  }

  const checkpoint = await persistence.coordinator.recover(runId);
  const stored = await persistence.store.loadEntries(runId);

  if (
    stored.length !== entries.length ||
    checkpoint?.state !== 'final_content_approved' ||
    checkpoint?.version !== entries.length
  ) {
    throw new Error('Provenance bootstrap verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    integrityHash: checkpoint.integrityHash,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
