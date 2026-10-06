'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');
const { parsePrivateDraftPayload } = require('../src/ai/runtime/native-evidence-mapping');
const {
  buildInstructionalReviewEvidence,
  assertInstructionalReviewContainment,
} = require('../src/ai/runtime/native-instructional-review');

const scenarioId = process.env.INSTRUCTIONAL_REVIEW_SCENARIO_ID || '';
const runId = process.env.INSTRUCTIONAL_REVIEW_RUN_ID || '';
const reviewerId = process.env.INSTRUCTIONAL_REVIEW_REVIEWER_ID || '';
const expectedPayloadSha = (process.env.INSTRUCTIONAL_REVIEW_PAYLOAD_SHA256 || '').toLowerCase();
const decision = (process.env.INSTRUCTIONAL_REVIEW_DECISION || '').toLowerCase();
const checklistCompleted = process.env.INSTRUCTIONAL_REVIEW_CHECKLIST_COMPLETED === 'true';
const submittedBy = process.env.GITHUB_ACTOR || process.env.INSTRUCTIONAL_REVIEW_SUBMITTED_BY || '';
const comments = process.env.INSTRUCTIONAL_REVIEW_COMMENTS || '';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function appendNote(existing, line) {
  return [existing, line].filter((value) => typeof value === 'string' && value.trim().length).join('\n');
}

(async () => {
  requireCondition(/^[a-z0-9-]+$/.test(scenarioId), 'A valid scenario_id is required.');
  requireCondition(/^[A-Za-z0-9._:-]+$/.test(runId), 'A valid governed_run_id is required.');
  requireCondition(/^[0-9a-f-]{36}$/i.test(reviewerId), 'A valid reviewer UUID is required.');
  requireCondition(/^[0-9a-f]{64}$/.test(expectedPayloadSha), 'A valid reviewed payload SHA-256 is required.');
  requireCondition(['pass', 'revise', 'reject'].includes(decision), 'Decision must be pass, revise, or reject.');
  requireCondition(checklistCompleted, 'The human instructional-review checklist must be completed before recording a decision.');
  requireCondition(submittedBy.length > 0, 'GitHub submission actor is required.');
  requireCondition(comments.length <= 4000, 'Instructional review comments exceed 4000 characters.');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-instructional-review'].join(':'),
  });
  if (!runtime.persistence.enabled || !runtime.governanceRuntime) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

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
  requireCondition(privateDraft.status === 'drafted-unreviewed', 'Private native draft status is not eligible for instructional review.');
  requireCondition(privateDraft.payload_sha256 === expectedPayloadSha, 'Reviewer-attested payload SHA does not match the private draft.');

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  requireCondition(question.question_id === privateDraft.question_id, 'Private native draft question identity mismatch.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  requireCondition(provenance, 'Draft provenance does not exist.');
  requireCondition(provenance.status === 'draft', 'Question provenance is not draft.');
  requireCondition(String(provenance.notes || '').includes(`private_draft_id=${privateDraft.id}`), 'Draft provenance is not bound to the expected private draft.');
  requireCondition(String(provenance.notes || '').includes(`payload_sha256=${privateDraft.payload_sha256}`), 'Draft provenance payload hash mismatch.');
  requireCondition(provenance.technical_reviewer_id && provenance.technical_reviewed_at, 'Instructional review requires completed technical review.');
  requireCondition(provenance.validation_checklist?.technical_review_complete === true, 'Technical review completion flag is missing.');
  requireCondition(provenance.validation_checklist?.technical_review_decision === 'pass', 'Technical review did not pass.');
  requireCondition(provenance.validation_checklist?.technical_review_payload_sha256 === expectedPayloadSha, 'Technical review payload binding mismatch.');
  requireCondition(!provenance.approved_by && !provenance.approved_at, 'Instructional review cannot run after final approval.');
  requireCondition(Boolean(provenance.instructional_reviewer_id) === Boolean(provenance.instructional_reviewed_at), 'Instructional review provenance contains a partial reviewer record.');

  const entries = await runtime.governanceRuntime.getRun(runId);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const alreadyAdvanced = latest?.action === 'instructional-review-recorded' && latest?.state === 'instructionally_reviewed';
  if (!alreadyAdvanced) {
    requireCondition(latest?.action === 'citation-validation-recorded' && latest?.state === 'citation_validated',
      'Instructional review requires the citation_validated state.');
  }
  const citationEntry = alreadyAdvanced
    ? entries.find((entry) => entry.action === 'citation-validation-recorded' && entry.state === 'citation_validated')
    : latest;
  requireCondition(citationEntry, 'Governed citation-validation ledger entry is missing.');
  requireCondition(/^[0-9a-f]{64}$/.test(citationEntry.metadata?.citationSetHash || ''), 'Citation-set hash is missing from governed ledger.');
  requireCondition(/^[0-9a-f]{64}$/.test(citationEntry.metadata?.validationEvidenceHash || ''), 'Citation-validation evidence hash is missing from governed ledger.');

  const { data: validations, error: validationError } = await client
    .from('citation_validations')
    .select('id,validator_version,validation_method,source_hashes_verified,excerpts_verified,urls_verified,result,errors,validated_at')
    .eq('question_provenance_id', provenance.id)
    .eq('validator_version', citationEntry.metadata.validatorVersion);
  if (validationError) throw validationError;
  requireCondition((validations || []).length === 1, 'Exactly one governed citation validation is required.');
  const citationValidation = validations[0];
  requireCondition(citationValidation.result === 'valid', 'Citation validation is not valid.');
  requireCondition(citationValidation.source_hashes_verified === true && citationValidation.excerpts_verified === true && citationValidation.urls_verified === true,
    'Citation validation did not verify all governed dimensions.');
  requireCondition(Date.parse(citationValidation.validated_at) === Date.parse(citationEntry.metadata.validatedAt),
    'Citation-validation timestamp does not match governed ledger evidence.');

  const { data: reviewer, error: reviewerError } = await client
    .from('profiles')
    .select('id,role')
    .eq('id', reviewerId)
    .maybeSingle();
  if (reviewerError) throw reviewerError;
  requireCondition(reviewer, 'Reviewer profile does not exist in production.');
  requireCondition(reviewer.role === 'instructional_reviewer', 'Reviewer profile role is not eligible for instructional review.');
  requireCondition(reviewerId !== provenance.technical_reviewer_id, 'Instructional reviewer must be independent from the technical reviewer.');

  const { data: reviewerAuth, error: reviewerAuthError } = await client.auth.admin.getUserById(reviewerId);
  if (reviewerAuthError) throw reviewerAuthError;
  requireCondition(reviewerAuth?.user, 'Reviewer Auth identity does not exist.');
  requireCondition(reviewerAuth.user.email_confirmed_at, 'Reviewer invite has not been accepted; email confirmation is required before instructional review.');
  requireCondition(reviewerAuth.user.app_metadata?.governance_role === reviewer.role,
    'Reviewer Auth governance role does not match the canonical profile role.');
  requireCondition(reviewerAuth.user.app_metadata?.governance_scope === 'native-question-instructional-review',
    'Reviewer Auth governance scope is not authorized for native instructional review.');

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

  assertInstructionalReviewContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    citationValidation,
    provenance,
  });

  const checklist = provenance.validation_checklist || {};
  if (
    checklist.instructional_review_payload_sha256 === expectedPayloadSha &&
    ['revise', 'reject'].includes(checklist.instructional_review_decision) &&
    decision === 'pass'
  ) {
    throw new Error('A prior non-pass instructional decision exists for this exact payload; revise the content before attempting pass.');
  }

  const existingSameDecisionTimestamp =
    checklist.instructional_review_payload_sha256 === expectedPayloadSha &&
    checklist.instructional_review_reviewer_id === reviewerId &&
    checklist.instructional_review_decision === decision
      ? checklist.instructional_review_reviewed_at
      : null;
  const reviewedAt = provenance.instructional_reviewed_at || existingSameDecisionTimestamp || new Date().toISOString();

  const { evidence, evidenceHash } = buildInstructionalReviewEvidence({
    provenanceId: provenance.id,
    questionId: question.question_id,
    payloadSha256: expectedPayloadSha,
    citationSetHash: citationEntry.metadata.citationSetHash,
    citationValidationEvidenceHash: citationEntry.metadata.validationEvidenceHash,
    reviewerId,
    reviewerRole: reviewer.role,
    technicalReviewerId: provenance.technical_reviewer_id,
    reviewedAt,
    decision,
    checklistCompleted,
    submittedBy,
    comments,
  });

  const instructionalChecklist = {
    ...checklist,
    instructional_review_complete: decision === 'pass',
    instructional_review_decision: decision,
    instructional_review_payload_sha256: expectedPayloadSha,
    instructional_review_citation_set_hash: citationEntry.metadata.citationSetHash,
    instructional_review_citation_validation_evidence_hash: citationEntry.metadata.validationEvidenceHash,
    instructional_review_reviewer_id: reviewerId,
    instructional_review_reviewer_role: reviewer.role,
    instructional_review_reviewed_at: reviewedAt,
    instructional_review_submitted_by: submittedBy,
    instructional_review_checklist_version: evidence.checklistVersion,
    instructional_review_checklist_completed: evidence.checklistCompleted,
    instructional_review_all_criteria_passed: evidence.allCriteriaPassed,
    instructional_review_comments: comments,
    instructional_review_evidence_hash: evidenceHash,
  };

  const note = [
    `[native-instructional-review] decision=${decision}`,
    `reviewer=${reviewerId}`,
    `payload_sha256=${expectedPayloadSha}`,
    `citation_set_hash=${citationEntry.metadata.citationSetHash}`,
    `submitted_by=${submittedBy}`,
    decision === 'pass'
      ? 'Human instructional review passed; no final approval, publication, or assessment authority is implied.'
      : 'Human instructional review did not pass; governed state remains citation_validated and content revision/replacement is required before advancement.',
  ].join(' ');

  if (decision !== 'pass') {
    requireCondition(!provenance.instructional_reviewer_id && !provenance.instructional_reviewed_at,
      'A completed passing instructional review already exists; non-pass overwrite is not permitted.');

    if (checklist.instructional_review_evidence_hash === evidenceHash) {
      console.log(JSON.stringify({
        runId,
        questionId: question.question_id,
        decision,
        state: 'citation_validated',
        advanced: false,
        idempotent: true,
        humanApproval: false,
      }));
      return;
    }

    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        validation_checklist: instructionalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'draft')
      .is('instructional_reviewer_id', null)
      .select('id,instructional_reviewer_id,instructional_reviewed_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Instructional review decision write lost an optimistic concurrency race.');

    console.log(JSON.stringify({
      runId,
      questionId: question.question_id,
      decision,
      state: 'citation_validated',
      advanced: false,
      payloadSha256: expectedPayloadSha,
      reviewerRole: reviewer.role,
      humanInstructionalDecisionCaptured: true,
      agentSynthesizedDecision: false,
      humanApproval: false,
      publicScenarioQuestionRows: 0,
      assessmentEligibilityRows: 0,
    }));
    return;
  }

  if (provenance.instructional_reviewer_id) {
    requireCondition(provenance.instructional_reviewer_id === reviewerId, 'Existing instructional reviewer identity mismatch.');
    requireCondition(checklist.instructional_review_payload_sha256 === expectedPayloadSha, 'Existing instructional review payload mismatch.');
    requireCondition(checklist.instructional_review_citation_set_hash === citationEntry.metadata.citationSetHash, 'Existing instructional review citation-set mismatch.');
    requireCondition(checklist.instructional_review_citation_validation_evidence_hash === citationEntry.metadata.validationEvidenceHash,
      'Existing instructional review citation-validation evidence mismatch.');
    requireCondition(checklist.instructional_review_decision === 'pass', 'Existing instructional review decision is not pass.');
    requireCondition(checklist.instructional_review_evidence_hash === evidenceHash, 'Existing instructional review evidence mismatch.');
  } else {
    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        instructional_reviewer_id: reviewerId,
        instructional_reviewed_at: reviewedAt,
        validation_checklist: instructionalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'draft')
      .is('instructional_reviewer_id', null)
      .is('approved_by', null)
      .select('id,instructional_reviewer_id,instructional_reviewed_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Instructional review pass write lost an optimistic concurrency race.');
  }

  await runtime.governanceRuntime.recordInstructionalReview({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    reviewEvidenceHash: evidenceHash,
    reviewEvidence: evidence,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  const instructionalEntries = finalEntries.filter((entry) => entry.action === 'instructional-review-recorded');

  const { data: finalProvenance, error: finalProvenanceError } = await client
    .from('question_provenance')
    .select('id,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('id', provenance.id)
    .maybeSingle();
  if (finalProvenanceError) throw finalProvenanceError;

  assertInstructionalReviewContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    citationValidation,
    provenance: finalProvenance,
  });

  requireCondition(finalProvenance.instructional_reviewer_id === reviewerId, 'Final instructional reviewer identity mismatch.');
  requireCondition(Date.parse(finalProvenance.instructional_reviewed_at) === Date.parse(reviewedAt), 'Final instructional review timestamp mismatch.');
  requireCondition(finalProvenance.validation_checklist?.instructional_review_complete === true, 'Final instructional review completion flag is missing.');
  requireCondition(instructionalEntries.length === 1, 'Expected exactly one governed instructional-review transition.');
  requireCondition(checkpoint?.version === 6 && checkpoint?.state === 'instructionally_reviewed' &&
    checkpoint?.action === 'instructional-review-recorded' && checkpoint?.status === 'instructionally-reviewed',
    'Governed instructional-review checkpoint verification failed.');
  requireCondition(finalEntries.every((entry) => entry.action !== 'human-approval-recorded'),
    'Instructional review must not create final human approval.');

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    decision: 'pass',
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    payloadSha256: expectedPayloadSha,
    citationSetHash: citationEntry.metadata.citationSetHash,
    citationValidationEvidenceHash: citationEntry.metadata.validationEvidenceHash,
    reviewerRole: reviewer.role,
    reviewerIndependentFromTechnical: reviewerId !== provenance.technical_reviewer_id,
    humanInstructionalDecisionCaptured: true,
    agentSynthesizedDecision: false,
    humanApproval: false,
    publicScenarioQuestionRows: 0,
    assessmentEligibilityRows: 0,
    releasedForAssessment: false,
    scoredDeliveryAuthority: false,
  }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
