'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');
const {
  parsePrivateDraftPayload,
  buildCitationRows,
  assertSameCitationSet,
} = require('../src/ai/runtime/native-evidence-mapping');
const {
  stableCitationSetHash,
  buildCitationValidationEvidence,
  assertCitationValidationContainment,
} = require('../src/ai/runtime/native-citation-validation');

const scenarioId = process.env.CITATION_VALIDATION_SCENARIO_ID || '';
const runId = process.env.CITATION_VALIDATION_RUN_ID || '';
const expectedPayloadSha = (process.env.CITATION_VALIDATION_PAYLOAD_SHA256 || '').toLowerCase();

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function verifyCanonicalUrl(value) {
  const parsed = new URL(String(value || '').trim());
  requireCondition(parsed.protocol === 'https:', 'Canonical source URL must use HTTPS.');
  const hostname = parsed.hostname.toLowerCase();
  requireCondition(hostname !== 'localhost' && hostname !== '::1' && !isPrivateIpv4(hostname),
    'Canonical source URL must resolve through a public hostname.');
  parsed.hash = '';
  const canonicalUrl = parsed.toString();
  const response = await fetch(canonicalUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'AutoLearnPro-Native-Citation-Validator/1.0' },
  });
  requireCondition(!(response.status >= 300 && response.status < 400),
    'Canonical source URL redirects; explicit revalidation is required.');
  requireCondition(response.ok, 'Canonical source URL returned HTTP ' + response.status + '.');
  return {
    canonicalUrl,
    httpStatus: response.status,
    redirectCount: 0,
    valid: true,
  };
}

(async () => {
  requireCondition(/^[a-z0-9-]+$/.test(scenarioId), 'A valid scenario_id is required.');
  requireCondition(/^[A-Za-z0-9._:-]+$/.test(runId), 'A valid governed_run_id is required.');
  requireCondition(/^[0-9a-f]{64}$/.test(expectedPayloadSha), 'A valid reviewed payload SHA-256 is required.');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-citation-validation'].join(':'),
  });
  requireCondition(runtime.persistence.enabled && runtime.governanceRuntime,
    'Production orchestration persistence must be enabled.');

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: privateDraft, error: draftError } = await client
    .from('native_governed_question_drafts')
    .select('id,governed_run_id,question_id,scenario_id,payload_sha256,status,payload_text')
    .eq('governed_run_id', runId)
    .maybeSingle();
  if (draftError) throw draftError;
  requireCondition(privateDraft, 'Private native draft does not exist.');
  requireCondition(privateDraft.scenario_id === scenarioId, 'Private native draft scenario mismatch.');
  requireCondition(privateDraft.status === 'drafted-unreviewed', 'Private native draft status is not eligible for citation validation.');
  requireCondition(privateDraft.payload_sha256 === expectedPayloadSha, 'Citation validation payload SHA does not match the private draft.');

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  requireCondition(question.question_id === privateDraft.question_id, 'Private native draft question identity mismatch.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  requireCondition(provenance, 'Draft provenance does not exist.');
  requireCondition(provenance.status === 'draft', 'Question provenance is not draft.');
  requireCondition(String(provenance.notes || '').includes('payload_sha256=' + expectedPayloadSha),
    'Draft provenance payload hash mismatch.');
  requireCondition(provenance.validation_checklist?.technical_review_complete === true &&
    provenance.validation_checklist?.technical_review_decision === 'pass' &&
    provenance.validation_checklist?.technical_review_payload_sha256 === expectedPayloadSha,
  'Citation validation requires a passing human technical review bound to this exact payload.');

  const entries = await runtime.governanceRuntime.getRun(runId);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const alreadyAdvanced = latest?.action === 'citation-validation-recorded' && latest?.state === 'citation_validated';
  if (!alreadyAdvanced) {
    requireCondition(latest?.action === 'technical-review-recorded' && latest?.state === 'technically_reviewed',
      'Citation validation requires the technically_reviewed state.');
    requireCondition(latest?.metadata?.payloadSha256 === expectedPayloadSha,
      'Governed technical-review payload hash does not match the requested validation payload.');
  }

  const currentDate = new Date().toISOString().slice(0, 10);

  const { data: citations, error: citationsError } = await client
    .from('question_citations')
    .select('id,question_provenance_id,source_id,chunk_id,locator,quote,role')
    .eq('question_provenance_id', provenance.id);
  if (citationsError) throw citationsError;
  requireCondition(Array.isArray(citations) && citations.length > 0, 'No mapped citations exist for this provenance.');

  const sourceIds = [...new Set(citations.map((row) => row.source_id))];
  const chunkIds = [...new Set(citations.map((row) => row.chunk_id))];

  const { data: sources, error: sourcesError } = await client
    .from('approved_sources')
    .select('id,status,storage_path,license,license_reviewed_by,license_reviewed_at')
    .in('id', sourceIds);
  if (sourcesError) throw sourcesError;

  const { data: chunks, error: chunksError } = await client
    .from('source_chunks')
    .select('chunk_id,source_id,status,approved,locator,text_excerpt,text_hash')
    .in('chunk_id', chunkIds);
  if (chunksError) throw chunksError;

  const { data: rightsScopes, error: scopesError } = await client
    .from('approved_source_rights_scopes')
    .select('source_id,citation_link_allowed,direct_excerpt_allowed,database_storage_allowed,effective_at,expires_at,license_evidence_reference,reviewed_by,reviewed_at')
    .in('source_id', sourceIds);
  if (scopesError) throw scopesError;

  const expectedCitationRows = buildCitationRows({
    question,
    provenanceId: provenance.id,
    sources,
    chunks,
    rightsScopes,
    currentDate,
  });
  assertSameCitationSet(citations, expectedCitationRows);

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

  assertCitationValidationContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    provenance,
  });

  const existingValidationResult = await client
    .from('citation_validations')
    .select('id,question_provenance_id,validator_version,validation_method,source_hashes_verified,excerpts_verified,urls_verified,result,errors,validated_at')
    .eq('question_provenance_id', provenance.id)
    .eq('validator_version', 'native-citation-validator-1.0')
    .maybeSingle();
  if (existingValidationResult.error) throw existingValidationResult.error;
  const existingValidation = existingValidationResult.data;

  const urlChecks = [];
  for (const source of sources || []) {
    const check = await verifyCanonicalUrl(source.storage_path);
    urlChecks.push({ sourceId: source.id, ...check });
  }

  const validatedAt = existingValidation?.validated_at || new Date().toISOString();
  const { evidence, evidenceHash } = buildCitationValidationEvidence({
    provenanceId: provenance.id,
    questionId: question.question_id,
    payloadSha256: expectedPayloadSha,
    citations,
    sources,
    chunks,
    rightsScopes,
    urlChecks,
    currentDate,
    validatedAt,
  });

  const validationRecord = {
    question_provenance_id: provenance.id,
    validator_version: evidence.validatorVersion,
    validation_method: evidence.validationMethod,
    source_hashes_verified: true,
    excerpts_verified: true,
    urls_verified: true,
    result: 'valid',
    errors: [],
    validated_at: validatedAt,
  };

  if (existingValidation) {
    requireCondition(
      existingValidation.validation_method === validationRecord.validation_method &&
      existingValidation.source_hashes_verified === true &&
      existingValidation.excerpts_verified === true &&
      existingValidation.urls_verified === true &&
      existingValidation.result === 'valid' &&
      Array.isArray(existingValidation.errors) &&
      existingValidation.errors.length === 0,
      'Existing native citation validation conflicts with current validation evidence.'
    );
  } else {
    const { error: insertError } = await client
      .from('citation_validations')
      .insert(validationRecord);
    if (insertError) throw insertError;
  }

  await runtime.governanceRuntime.recordCitationValidation({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    citationCount: citations.length,
    citationSetHash: stableCitationSetHash(citations),
    validationEvidenceHash: evidenceHash,
    validationEvidence: evidence,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  const validationEntries = finalEntries.filter((entry) => entry.action === 'citation-validation-recorded');

  const { data: finalProvenance, error: finalProvenanceError } = await client
    .from('question_provenance')
    .select('id,status,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('id', provenance.id)
    .maybeSingle();
  if (finalProvenanceError) throw finalProvenanceError;

  assertCitationValidationContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    provenance: finalProvenance,
  });
  requireCondition(validationEntries.length === 1, 'Expected exactly one governed citation-validation transition.');
  requireCondition(checkpoint?.version === 5 &&
    checkpoint?.state === 'citation_validated' &&
    checkpoint?.action === 'citation-validation-recorded' &&
    checkpoint?.status === 'citation-validated',
  'Governed citation-validation checkpoint verification failed.');
  requireCondition(finalEntries.every((entry) => entry.action !== 'human-approval-recorded'),
    'Citation validation must not create final human approval.');

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    payloadSha256: expectedPayloadSha,
    citationCount: citations.length,
    citationSetHash: evidence.citationSetHash,
    validationEvidenceHash: evidenceHash,
    sourceHashesVerified: true,
    excerptsVerified: true,
    urlsVerified: true,
    result: 'valid',
    publicScenarioQuestionRows: 0,
    assessmentEligibilityRows: 0,
    humanApproval: false,
    releasedForAssessment: false,
    scoredDeliveryAuthority: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
