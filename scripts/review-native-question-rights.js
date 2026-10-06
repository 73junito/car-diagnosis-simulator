'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact, assertDraftProvenance } = require('../src/ai/runtime/native-question-draft');
const {
  parsePrivateDraftPayload,
  buildCitationRows,
  assertSameCitationSet,
} = require('../src/ai/runtime/native-evidence-mapping');
const {
  buildRightsReviewEvidence,
  assertRightsReviewInvariants,
} = require('../src/ai/runtime/native-rights-review');

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const scenarioId = args.scenario || '';
const runId = args['run-id'] || '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(scenarioId)) fail('A valid --scenario is required.');
if (!/^[A-Za-z0-9._:-]+$/.test(runId)) fail('A valid --run-id is required.');

(async () => {
  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-rights-review'].join(':'),
  });
  if (!runtime.persistence.enabled || !runtime.governanceRuntime) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: privateDraft, error: privateDraftError } = await client
    .from('native_governed_question_drafts')
    .select('id,governed_run_id,question_id,scenario_id,payload_sha256,status,payload_text')
    .eq('governed_run_id', runId)
    .maybeSingle();
  if (privateDraftError) throw privateDraftError;
  if (!privateDraft) throw new Error('Private native draft does not exist.');
  if (privateDraft.scenario_id !== scenarioId) throw new Error('Private native draft scenario mismatch.');
  if (privateDraft.status !== 'drafted-unreviewed') throw new Error('Private native draft status is not eligible for rights review.');

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  if (question.question_id !== privateDraft.question_id) throw new Error('Private native draft question identity mismatch.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  if (!provenance) throw new Error('Draft provenance does not exist.');
  assertDraftProvenance(provenance, question.question_id, {
    privateDraftId: privateDraft.id,
    payloadSha256: privateDraft.payload_sha256,
  });

  const runEntries = await runtime.governanceRuntime.getRun(runId);
  const allowedActions = new Set(['draft-initialized', 'evidence-mapping-recorded', 'rights-review-recorded']);
  if (!runEntries.length || runEntries.some((entry) => !allowedActions.has(entry.action))) {
    throw new Error('Governed run contains unexpected state before rights review.');
  }
  const mappingEntries = runEntries.filter((entry) => entry.action === 'evidence-mapping-recorded');
  if (
    mappingEntries.length !== 1 ||
    mappingEntries[0].state !== 'evidence_mapped' ||
    mappingEntries[0].metadata?.questionId !== question.question_id ||
    mappingEntries[0].metadata?.provenanceId !== provenance.id
  ) {
    throw new Error('Governed evidence mapping is missing or mismatched.');
  }

  const { data: persistedCitations, error: citationsError } = await client
    .from('question_citations')
    .select('id,question_provenance_id,source_id,chunk_id,locator,quote,role')
    .eq('question_provenance_id', provenance.id);
  if (citationsError) throw citationsError;
  if (!persistedCitations.length) throw new Error('Persisted evidence mapping is missing.');

  const sourceIds = [...new Set(persistedCitations.map((row) => row.source_id))];
  const chunkIds = [...new Set(persistedCitations.map((row) => row.chunk_id))];

  const { data: sources, error: sourcesError } = await client
    .from('approved_sources')
    .select('id,status,license,license_reviewed_at,license_reviewed_by')
    .in('id', sourceIds);
  if (sourcesError) throw sourcesError;

  const { data: chunks, error: chunksError } = await client
    .from('source_chunks')
    .select('chunk_id,source_id,status,approved,locator,text_excerpt')
    .in('chunk_id', chunkIds);
  if (chunksError) throw chunksError;

  const { data: rightsScopes, error: rightsError } = await client
    .from('approved_source_rights_scopes')
    .select('source_id,citation_link_allowed,direct_excerpt_allowed,database_storage_allowed,effective_at,expires_at,license_evidence_reference,reviewed_by,reviewed_at')
    .in('source_id', sourceIds);
  if (rightsError) throw rightsError;

  const currentDate = new Date().toISOString().slice(0, 10);
  const expectedCitations = buildCitationRows({
    question,
    provenanceId: provenance.id,
    sources,
    chunks,
    rightsScopes,
    currentDate,
  });
  assertSameCitationSet(persistedCitations, expectedCitations);

  const { evidence: rightsEvidence, evidenceHash } = buildRightsReviewEvidence({
    citations: persistedCitations,
    sources,
    rightsScopes,
    currentDate,
  });

  const { data: publicQuestions, error: publicQuestionsError } = await client
    .from('scenario_questions')
    .select('id')
    .eq('question_id', question.question_id);
  if (publicQuestionsError) throw publicQuestionsError;

  let assessmentEligibilityCount = 0;
  if ((publicQuestions || []).length) {
    const { count, error } = await client
      .from('assessment_question_eligibility')
      .select('question_id', { count: 'exact', head: true })
      .in('question_id', publicQuestions.map((row) => row.id));
    if (error) throw error;
    assessmentEligibilityCount = count || 0;
  }

  const { count: citationValidationCount, error: validationCountError } = await client
    .from('citation_validations')
    .select('id', { count: 'exact', head: true })
    .eq('question_provenance_id', provenance.id);
  if (validationCountError) throw validationCountError;

  const { data: provenanceNow, error: provenanceNowError } = await client
    .from('question_provenance')
    .select('id,question_id,status,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('id', provenance.id)
    .maybeSingle();
  if (provenanceNowError) throw provenanceNowError;

  assertRightsReviewInvariants({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    citationValidationCount: citationValidationCount || 0,
    provenance: provenanceNow,
  });

  await runtime.governanceRuntime.recordRightsReview({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    sourceCount: rightsEvidence.length,
    rightsEvidenceHash: evidenceHash,
    rightsEvidence,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  const rightsEntries = finalEntries.filter((entry) => entry.action === 'rights-review-recorded');
  const rightsEntry = rightsEntries[0];

  if (
    finalEntries.length !== 3 ||
    rightsEntries.length !== 1 ||
    rightsEntry?.state !== 'rights_reviewed' ||
    rightsEntry?.actor !== 'rights-agent' ||
    rightsEntry?.metadata?.rightsEvidenceHash !== evidenceHash ||
    rightsEntry?.metadata?.existingHumanRightsReviewsBound !== true ||
    rightsEntry?.metadata?.newHumanDecision !== false ||
    rightsEntry?.metadata?.humanApproval !== false ||
    checkpoint?.state !== 'rights_reviewed' ||
    checkpoint?.action !== 'rights-review-recorded' ||
    checkpoint?.status !== 'rights-reviewed' ||
    checkpoint?.version !== 3 ||
    finalEntries.some((entry) => entry.action === 'human-approval-recorded')
  ) {
    throw new Error('Native rights review verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    sourceCount: rightsEvidence.length,
    rightsEvidenceHash: evidenceHash,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    publicScenarioQuestionRows: (publicQuestions || []).length,
    assessmentEligibilityRows: assessmentEligibilityCount,
    citationValidationRows: citationValidationCount || 0,
    newHumanDecision: false,
    humanApproval: false,
    scoredDeliveryAuthority: false,
    releasedForAssessment: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
