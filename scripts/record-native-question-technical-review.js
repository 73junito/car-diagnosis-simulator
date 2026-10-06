'use strict';

const { createClient } = require('@supabase/supabase-js');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');
const { parsePrivateDraftPayload } = require('../src/ai/runtime/native-evidence-mapping');
const {
  buildTechnicalReviewEvidence,
  assertTechnicalReviewContainment,
} = require('../src/ai/runtime/native-technical-review');

const scenarioId = process.env.TECHNICAL_REVIEW_SCENARIO_ID || '';
const runId = process.env.TECHNICAL_REVIEW_RUN_ID || '';
const reviewerId = process.env.TECHNICAL_REVIEW_REVIEWER_ID || '';
const expectedPayloadSha = (process.env.TECHNICAL_REVIEW_PAYLOAD_SHA256 || '').toLowerCase();
const decision = (process.env.TECHNICAL_REVIEW_DECISION || '').toLowerCase();
const checklistCompleted = process.env.TECHNICAL_REVIEW_CHECKLIST_COMPLETED === 'true';
const submittedBy = process.env.GITHUB_ACTOR || process.env.TECHNICAL_REVIEW_SUBMITTED_BY || '';
const comments = process.env.TECHNICAL_REVIEW_COMMENTS || '';

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
  requireCondition(checklistCompleted, 'The human technical-review checklist must be completed before recording a decision.');
  requireCondition(submittedBy.length > 0, 'GitHub submission actor is required.');
  requireCondition(comments.length <= 4000, 'Technical review comments exceed 4000 characters.');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-technical-review'].join(':'),
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
  requireCondition(privateDraft.status === 'drafted-unreviewed', 'Private native draft status is not eligible for technical review.');
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
  requireCondition(provenance.question_id === question.question_id, 'Question provenance semantic ID mismatch.');
  requireCondition(provenance.status === 'draft', 'Question provenance is not draft.');
  requireCondition(
    String(provenance.notes || '').includes(`private_draft_id=${privateDraft.id}`),
    'Draft provenance is not bound to the expected private draft.'
  );
  requireCondition(
    String(provenance.notes || '').includes(`payload_sha256=${privateDraft.payload_sha256}`),
    'Draft provenance payload hash mismatch.'
  );
  requireCondition(
    !provenance.instructional_reviewer_id &&
      !provenance.instructional_reviewed_at &&
      !provenance.approved_by &&
      !provenance.approved_at,
    'Technical review cannot run after instructional review or approval.'
  );
  requireCondition(
    Boolean(provenance.technical_reviewer_id) === Boolean(provenance.technical_reviewed_at),
    'Technical review provenance contains a partial reviewer record.'
  );

  const entries = await runtime.governanceRuntime.getRun(runId);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const alreadyAdvanced = latest?.action === 'technical-review-recorded' && latest?.state === 'technically_reviewed';
  if (!alreadyAdvanced) {
    requireCondition(latest?.action === 'rights-review-recorded' && latest?.state === 'rights_reviewed',
      'Technical review requires the rights_reviewed state.');
  }

  const { data: reviewer, error: reviewerError } = await client
    .from('profiles')
    .select('id,role')
    .eq('id', reviewerId)
    .maybeSingle();
  if (reviewerError) throw reviewerError;
  requireCondition(reviewer, 'Reviewer profile does not exist in production.');
  requireCondition(
    reviewer.role === 'developer_reviewer' || reviewer.role === 'technical_reviewer',
    'Reviewer profile role is not eligible for technical review.'
  );

  const { data: reviewerAuth, error: reviewerAuthError } = await client.auth.admin.getUserById(reviewerId);
  if (reviewerAuthError) throw reviewerAuthError;
  requireCondition(reviewerAuth?.user, 'Reviewer Auth identity does not exist.');
  requireCondition(
    reviewerAuth.user.email_confirmed_at,
    'Reviewer invite has not been accepted; email confirmation is required before technical review.'
  );
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_role === reviewer.role,
    'Reviewer Auth governance role does not match the canonical profile role.'
  );
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_scope === 'native-question-technical-review',
    'Reviewer Auth governance scope is not authorized for native technical review.'
  );

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

  const { count: citationValidationCount, error: citationValidationError } = await client
    .from('citation_validations')
    .select('id', { count: 'exact', head: true })
    .eq('question_provenance_id', provenance.id);
  if (citationValidationError) throw citationValidationError;

  assertTechnicalReviewContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    citationValidationCount: citationValidationCount || 0,
    provenance,
  });

  const checklist = provenance.validation_checklist || {};
  if (
    checklist.technical_review_payload_sha256 === expectedPayloadSha &&
    ['revise', 'reject'].includes(checklist.technical_review_decision) &&
    decision === 'pass'
  ) {
    throw new Error('A prior non-pass decision exists for this exact payload; revise the content before attempting pass.');
  }

  const existingSameDecisionTimestamp =
    checklist.technical_review_payload_sha256 === expectedPayloadSha &&
    checklist.technical_review_reviewer_id === reviewerId &&
    checklist.technical_review_decision === decision
      ? checklist.technical_review_reviewed_at
      : null;
  const reviewedAt = provenance.technical_reviewed_at || existingSameDecisionTimestamp || new Date().toISOString();
  const { evidence, evidenceHash } = buildTechnicalReviewEvidence({
    provenanceId: provenance.id,
    questionId: question.question_id,
    payloadSha256: expectedPayloadSha,
    reviewerId,
    reviewerRole: reviewer.role,
    reviewedAt,
    decision,
    checklistCompleted,
    submittedBy,
    comments,
  });

  const technicalChecklist = {
    ...checklist,
    technical_review_complete: decision === 'pass',
    technical_review_decision: decision,
    technical_review_payload_sha256: expectedPayloadSha,
    technical_review_reviewer_id: reviewerId,
    technical_review_reviewer_role: reviewer.role,
    technical_review_reviewed_at: reviewedAt,
    technical_review_submitted_by: submittedBy,
    technical_review_checklist_version: evidence.checklistVersion,
    technical_review_checklist_completed: evidence.checklistCompleted,
    technical_review_all_criteria_passed: evidence.allCriteriaPassed,
    technical_review_comments: comments,
    technical_review_evidence_hash: evidenceHash,
  };

  const note = [
    `[native-technical-review] decision=${decision}`,
    `reviewer=${reviewerId}`,
    `payload_sha256=${expectedPayloadSha}`,
    `submitted_by=${submittedBy}`,
    decision === 'pass'
      ? 'Human technical review passed; no instructional review or approval is implied.'
      : 'Human technical review did not pass; governed state remains rights_reviewed and content revision/replacement is required before advancement.',
  ].join(' ');

  if (decision !== 'pass') {
    requireCondition(!provenance.technical_reviewer_id && !provenance.technical_reviewed_at,
      'A completed passing technical review already exists; non-pass overwrite is not permitted.');

    if (checklist.technical_review_evidence_hash === evidenceHash) {
      console.log(JSON.stringify({
        runId,
        questionId: question.question_id,
        decision,
        state: 'rights_reviewed',
        advanced: false,
        idempotent: true,
        payloadSha256: expectedPayloadSha,
        reviewerRole: reviewer.role,
        humanTechnicalDecisionCaptured: true,
        agentSynthesizedDecision: false,
        humanApproval: false,
      }));
      return;
    }

    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        validation_checklist: technicalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'draft')
      .is('technical_reviewer_id', null)
      .select('id,technical_reviewer_id,technical_reviewed_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Technical review decision write lost an optimistic concurrency race.');

    console.log(JSON.stringify({
      runId,
      questionId: question.question_id,
      decision,
      state: 'rights_reviewed',
      advanced: false,
      payloadSha256: expectedPayloadSha,
      reviewerRole: reviewer.role,
      humanTechnicalDecisionCaptured: true,
      agentSynthesizedDecision: false,
      humanApproval: false,
      publicScenarioQuestionRows: 0,
      assessmentEligibilityRows: 0,
      citationValidationRows: citationValidationCount || 0,
    }));
    return;
  }

  if (provenance.technical_reviewer_id) {
    requireCondition(provenance.technical_reviewer_id === reviewerId, 'Existing technical reviewer identity mismatch.');
    requireCondition(checklist.technical_review_payload_sha256 === expectedPayloadSha, 'Existing technical review payload mismatch.');
    requireCondition(checklist.technical_review_decision === 'pass', 'Existing technical review decision is not pass.');
    requireCondition(checklist.technical_review_evidence_hash === evidenceHash, 'Existing technical review evidence mismatch.');
  } else {
    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        technical_reviewer_id: reviewerId,
        technical_reviewed_at: reviewedAt,
        validation_checklist: technicalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'draft')
      .is('technical_reviewer_id', null)
      .select('id,technical_reviewer_id,technical_reviewed_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Technical review pass write lost an optimistic concurrency race.');
  }

  await runtime.governanceRuntime.recordTechnicalReview({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    reviewEvidenceHash: evidenceHash,
    reviewEvidence: evidence,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  const technicalEntries = finalEntries.filter((entry) => entry.action === 'technical-review-recorded');

  const { data: finalProvenance, error: finalProvenanceError } = await client
    .from('question_provenance')
    .select('id,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('id', provenance.id)
    .maybeSingle();
  if (finalProvenanceError) throw finalProvenanceError;

  assertTechnicalReviewContainment({
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
    citationValidationCount: citationValidationCount || 0,
    provenance: finalProvenance,
  });

  requireCondition(finalProvenance.technical_reviewer_id === reviewerId, 'Final technical reviewer identity mismatch.');
  requireCondition(Date.parse(finalProvenance.technical_reviewed_at) === Date.parse(reviewedAt), 'Final technical review timestamp mismatch.');
  requireCondition(finalProvenance.validation_checklist?.technical_review_complete === true, 'Final technical review completion flag is missing.');
  requireCondition(technicalEntries.length === 1, 'Expected exactly one governed technical-review transition.');
  requireCondition(checkpoint?.version === 4 && checkpoint?.state === 'technically_reviewed' &&
    checkpoint?.action === 'technical-review-recorded' && checkpoint?.status === 'technically-reviewed',
  'Governed technical-review checkpoint verification failed.');
  requireCondition(finalEntries.every((entry) => entry.action !== 'human-approval-recorded'),
    'Technical review must not create final human approval.');

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    decision: 'pass',
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    payloadSha256: expectedPayloadSha,
    reviewerRole: reviewer.role,
    humanTechnicalDecisionCaptured: true,
    agentSynthesizedDecision: false,
    humanApproval: false,
    publicScenarioQuestionRows: 0,
    assessmentEligibilityRows: 0,
    citationValidationRows: citationValidationCount || 0,
    releasedForAssessment: false,
    scoredDeliveryAuthority: false,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
