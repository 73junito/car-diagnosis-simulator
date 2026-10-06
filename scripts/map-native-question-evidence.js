'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const {
  validateNativeDraftArtifact,
  assertDraftProvenance,
} = require('../src/ai/runtime/native-question-draft');
const {
  parsePrivateDraftPayload,
  buildCitationRows,
  assertSameCitationSet,
  assertMappingInvariants,
} = require('../src/ai/runtime/native-evidence-mapping');

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
  const workerId = [
    'github-actions',
    process.env.GITHUB_RUN_ID || 'local',
    process.env.GITHUB_RUN_ATTEMPT || '1',
    'native-draft-evidence-map',
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

  // Phase 10C reads the answer-bearing draft from the private store. The
  // draft is never promoted into public scenario_questions by this script.
  const { data: privateDraft, error: privateDraftError } = await client
    .from('native_governed_question_drafts')
    .select('id,governed_run_id,question_id,scenario_id,payload_sha256,status,payload_text,created_at')
    .eq('governed_run_id', runId)
    .maybeSingle();
  if (privateDraftError) throw privateDraftError;
  if (!privateDraft) {
    throw new Error('Private native draft does not exist; run native draft creation first.');
  }
  if (privateDraft.scenario_id !== scenarioId) {
    throw new Error('Private native draft scenario mismatch.');
  }
  if (privateDraft.status !== 'drafted-unreviewed') {
    throw new Error('Private native draft is not in the drafted-unreviewed state.');
  }

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  if (question.question_id !== privateDraft.question_id) {
    throw new Error('Private native draft question identity mismatch.');
  }

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  if (!provenance) {
    throw new Error('Draft provenance does not exist; run native draft creation first.');
  }
  assertDraftProvenance(provenance, question.question_id, {
    privateDraftId: privateDraft.id,
    payloadSha256: privateDraft.payload_sha256,
  });

  const runEntries = await runtime.governanceRuntime.getRun(runId);
  if (!runEntries.length) {
    throw new Error('Governed run is not initialized; run native draft creation first.');
  }
  const draftInitEntries = runEntries.filter((entry) => entry.action === 'draft-initialized');
  if (
    draftInitEntries.length !== 1 ||
    draftInitEntries[0].state !== 'drafted' ||
    draftInitEntries[0].metadata?.questionId !== question.question_id ||
    draftInitEntries[0].metadata?.provenanceId !== provenance.id
  ) {
    throw new Error('Governed run draft initialization is missing or mismatched.');
  }
  const unexpectedEntries = runEntries.filter(
    (entry) =>
      entry.action !== 'draft-initialized' && entry.action !== 'evidence-mapping-recorded'
  );
  if (unexpectedEntries.length) {
    throw new Error('Governed run contains unexpected entries before evidence mapping.');
  }

  // Fail closed before any citation write if this semantic question has already
  // crossed the private-until-promotion boundary.
  const { data: publicQuestionsBefore, error: publicQuestionsBeforeError } = await client
    .from('scenario_questions')
    .select('id')
    .eq('question_id', question.question_id);
  if (publicQuestionsBeforeError) throw publicQuestionsBeforeError;
  assertMappingInvariants({
    scenarioQuestionCount: (publicQuestionsBefore || []).length,
    provenance,
  });

  const sourceIds = [...new Set(question.citations.map((citation) => citation.source_id))];
  const chunkIds = [...new Set(question.citations.map((citation) => citation.chunk_id))];

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

  const { data: rightsScopes, error: rightsScopesError } = await client
    .from('approved_source_rights_scopes')
    .select('source_id,citation_link_allowed,direct_excerpt_allowed,database_storage_allowed,effective_at,expires_at,license_evidence_reference,reviewed_by,reviewed_at')
    .in('source_id', sourceIds);
  if (rightsScopesError) throw rightsScopesError;

  const expectedRows = buildCitationRows({
    question,
    provenanceId: provenance.id,
    sources,
    chunks,
    rightsScopes,
    currentDate: new Date().toISOString().slice(0, 10),
  });

  const { data: existingCitations, error: existingCitationsError } = await client
    .from('question_citations')
    .select('id,question_provenance_id,source_id,chunk_id,locator,quote,role')
    .eq('question_provenance_id', provenance.id);
  if (existingCitationsError) throw existingCitationsError;

  if (!existingCitations.length) {
    const { error: insertCitationsError } = await client
      .from('question_citations')
      .insert(expectedRows);
    if (insertCitationsError) throw insertCitationsError;
  } else {
    assertSameCitationSet(existingCitations, expectedRows);
  }

  const { data: persistedCitations, error: persistedCitationsError } = await client
    .from('question_citations')
    .select('id,question_provenance_id,source_id,chunk_id,locator,quote,role')
    .eq('question_provenance_id', provenance.id);
  if (persistedCitationsError) throw persistedCitationsError;
  assertSameCitationSet(persistedCitations, expectedRows);

  // Verify containment invariants before recording the governed transition.
  const { data: publicQuestions, error: publicQuestionsError } = await client
    .from('scenario_questions')
    .select('id')
    .eq('question_id', question.question_id);
  if (publicQuestionsError) throw publicQuestionsError;
  const scenarioQuestionCount = (publicQuestions || []).length;

  let assessmentEligibilityCount = 0;
  if (scenarioQuestionCount > 0) {
    const { count: eligibilityCount, error: eligibilityError } = await client
      .from('assessment_question_eligibility')
      .select('question_id', { count: 'exact', head: true })
      .in('question_id', (publicQuestions || []).map((row) => row.id));
    if (eligibilityError) throw eligibilityError;
    assessmentEligibilityCount = eligibilityCount || 0;
  }

  const { data: provenanceNow, error: provenanceNowError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('id', provenance.id)
    .maybeSingle();
  if (provenanceNowError) throw provenanceNowError;

  assertMappingInvariants({
    scenarioQuestionCount,
    provenance: provenanceNow,
  });
  if (assessmentEligibilityCount !== 0) {
    throw new Error('Native evidence mapping must not create assessment eligibility.');
  }

  await runtime.governanceRuntime.recordEvidenceMapping({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    citationCount: expectedRows.length,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);

  const mappingEntries = finalEntries.filter((entry) => entry.action === 'evidence-mapping-recorded');
  if (
    finalEntries.length !== 2 ||
    mappingEntries.length !== 1 ||
    mappingEntries[0].state !== 'evidence_mapped' ||
    mappingEntries[0].actor !== 'evidence-agent' ||
    mappingEntries[0].metadata?.questionId !== question.question_id ||
    mappingEntries[0].metadata?.provenanceId !== provenance.id ||
    mappingEntries[0].metadata?.citationCount !== expectedRows.length ||
    mappingEntries[0].metadata?.humanApproval !== false ||
    checkpoint?.state !== 'evidence_mapped' ||
    checkpoint?.action !== 'evidence-mapping-recorded' ||
    checkpoint?.status !== 'evidence-mapped' ||
    checkpoint?.version !== finalEntries.length ||
    checkpoint?.metadata?.humanApproval !== false ||
    finalEntries.some((entry) => entry.action === 'human-approval-recorded')
  ) {
    throw new Error('Native evidence mapping verification failed.');
  }

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    citationsPersisted: persistedCitations.length,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    integrityHash: checkpoint.integrityHash,
    publicScenarioQuestionRows: scenarioQuestionCount,
    assessmentEligibilityRows: assessmentEligibilityCount,
    humanReviewFieldsEmpty: true,
    approvalFieldsEmpty: true,
    scoredDeliveryAuthority: false,
    releasedForAssessment: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
