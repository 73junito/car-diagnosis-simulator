'use strict';

const { createClient } = require('@supabase/supabase-js');
const contract = require('../data/architecture/agent-orchestration-native-final-content-approval.json');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');
const { parsePrivateDraftPayload } = require('../src/ai/runtime/native-evidence-mapping');
const {
  assertFinalContentApprovalActivationGate,
  buildFinalContentApprovalEvidence,
  assertInstructionalReviewEvidenceBinding,
  assertFinalContentApprovalContainment,
} = require('../src/ai/runtime/native-final-content-approval');

const scenarioId = process.env.FINAL_APPROVAL_SCENARIO_ID || '';
const runId = process.env.FINAL_APPROVAL_RUN_ID || '';
const reviewerId = process.env.FINAL_APPROVAL_REVIEWER_ID || '';
const expectedPayloadSha = (process.env.FINAL_APPROVAL_PAYLOAD_SHA256 || '').toLowerCase();
const decision = (process.env.FINAL_APPROVAL_DECISION || '').toLowerCase();
const checklistCompleted = process.env.FINAL_APPROVAL_CHECKLIST_COMPLETED === 'true';
const submittedBy = process.env.GITHUB_ACTOR || process.env.FINAL_APPROVAL_SUBMITTED_BY || '';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function appendNote(existing, line) {
  return [existing, line].filter((value) => typeof value === 'string' && value.trim().length).join('\n');
}

async function readContainment(client, questionId) {
  const { data: publicQuestions, error: publicQuestionsError } = await client
    .from('scenario_questions')
    .select('id')
    .eq('question_id', questionId);
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

  return {
    scenarioQuestionCount: (publicQuestions || []).length,
    assessmentEligibilityCount,
  };
}

(async () => {
  assertFinalContentApprovalActivationGate(contract);
  requireCondition(process.env.TORQUEMIND_ENVIRONMENT === 'production', 'Final approval recording is production-only.');
  requireCondition(/^[a-z0-9-]+$/.test(scenarioId), 'A valid scenario_id is required.');
  requireCondition(/^[A-Za-z0-9._:-]+$/.test(runId), 'A valid governed_run_id is required.');
  requireCondition(/^[0-9a-f-]{36}$/i.test(reviewerId), 'A valid final approver UUID is required.');
  requireCondition(/^[0-9a-f]{64}$/.test(expectedPayloadSha), 'A valid reviewed payload SHA-256 is required.');
  requireCondition(['approve', 'reject'].includes(decision), 'Final approval decision must be approve or reject.');
  requireCondition(checklistCompleted, 'The human final-approval checklist must be completed before recording a decision.');
  requireCondition(submittedBy.length > 0, 'GitHub submission actor is required.');

  const expected = contract.referenced_10G_evidence;
  requireCondition(runId === expected.governed_run_id, 'Phase 10H run ID does not match the approved Phase 10G control point.');
  requireCondition(scenarioId === 'charging-system', 'Phase 10H activation is scoped to the charging-system governed run.');
  requireCondition(expectedPayloadSha === expected.payload_sha256, 'Phase 10H payload hash does not match the approved Phase 10G control point.');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-final-content-approval'].join(':'),
  });
  requireCondition(runtime.persistence.enabled && runtime.governanceRuntime, 'Production orchestration persistence must be enabled.');

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
  requireCondition(privateDraft.status === 'drafted-unreviewed', 'Private native draft status changed unexpectedly.');
  requireCondition(privateDraft.payload_sha256 === expectedPayloadSha, 'Reviewer-attested payload SHA does not match the private draft.');

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  requireCondition(question.question_id === privateDraft.question_id, 'Private native draft question identity mismatch.');
  requireCondition(question.question_id === expected.question_id, 'Question ID does not match the approved Phase 10G control point.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,provenance_version,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at,notes')
    .eq('question_id', question.question_id)
    .order('provenance_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  requireCondition(provenance, 'Question provenance does not exist.');
  requireCondition(provenance.id === expected.provenance_id, 'Provenance ID does not match the approved Phase 10G control point.');
  requireCondition(String(provenance.notes || '').includes(`private_draft_id=${privateDraft.id}`), 'Provenance is not bound to the expected private draft.');
  requireCondition(String(provenance.notes || '').includes(`payload_sha256=${privateDraft.payload_sha256}`), 'Provenance payload hash mismatch.');

  const checklist = provenance.validation_checklist || {};
  requireCondition(provenance.technical_reviewer_id && provenance.technical_reviewed_at, 'Final approval requires completed technical review.');
  requireCondition(provenance.instructional_reviewer_id && provenance.instructional_reviewed_at, 'Final approval requires completed instructional review.');
  requireCondition(checklist.technical_review_complete === true && checklist.technical_review_decision === 'pass', 'Technical review is not complete and passing.');
  requireCondition(checklist.instructional_review_complete === true && checklist.instructional_review_decision === 'pass', 'Instructional review is not complete and passing.');
  requireCondition(checklist.instructional_review_payload_sha256 === expectedPayloadSha, 'Instructional review payload binding mismatch.');
  requireCondition(checklist.instructional_review_citation_set_hash === expected.citation_set_hash, 'Instructional review citation-set binding mismatch.');
  requireCondition(checklist.instructional_review_citation_validation_evidence_hash === expected.citation_validation_evidence_hash, 'Instructional review citation-validation binding mismatch.');
  requireCondition(checklist.instructional_review_evidence_hash === expected.instructional_review_evidence_hash, 'Instructional review evidence hash mismatch.');

  const entries = await runtime.governanceRuntime.getRun(runId);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const rightsReviewEntry = entries.find(
    (entry) => entry.action === 'rights-review-recorded' && entry.state === 'rights_reviewed'
  );
  const citationValidationEntry = entries.find(
    (entry) => entry.action === 'citation-validation-recorded' && entry.state === 'citation_validated'
  );
  requireCondition(rightsReviewEntry, 'Final approval requires the governed rights-review-recorded predecessor.');
  requireCondition(citationValidationEntry, 'Final approval requires the governed citation-validation-recorded predecessor.');
  const existingFinal = latest?.action === 'final-content-approval-recorded' && latest?.state === 'final_content_approved';

  if (existingFinal) {
    requireCondition(provenance.status === 'approved', 'Existing final-content ledger state requires approved provenance.');
    requireCondition(provenance.approved_by === reviewerId, 'Existing final approver identity mismatch.');
    requireCondition(checklist.final_approval_decision === 'approve', 'Existing final approval decision is not approve.');
    requireCondition(checklist.final_approval_payload_sha256 === expectedPayloadSha, 'Existing final approval payload mismatch.');
    requireCondition(checklist.final_approval_instructional_review_evidence_hash === expected.instructional_review_evidence_hash, 'Existing final approval Phase 10G evidence mismatch.');

    const containment = await readContainment(client, question.question_id);
    assertFinalContentApprovalContainment({
      ...containment,
      provenance,
      reviewerId,
    });
    const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
    requireCondition(
      checkpoint?.version === 7 &&
      checkpoint?.state === 'final_content_approved' &&
      checkpoint?.action === 'final-content-approval-recorded' &&
      checkpoint?.status === 'final-content-approved',
      'Existing final-content approval checkpoint verification failed.'
    );

    console.log(JSON.stringify({
      runId,
      questionId: question.question_id,
      provenanceId: provenance.id,
      decision: 'approve',
      state: checkpoint.state,
      version: checkpoint.version,
      status: checkpoint.status,
      idempotent: true,
      finalApproverRole: contract.governance_constants.FINAL_APPROVER_REQUIRED_ROLE,
      finalApproverScope: contract.governance_constants.FINAL_APPROVER_REQUIRED_SCOPE,
      publicScenarioQuestionRows: containment.scenarioQuestionCount,
      assessmentEligibilityRows: containment.assessmentEligibilityCount,
      releasedForAssessment: false,
      scoredDeliveryAuthority: false,
      deliveryAuthority: false,
      releaseAuthority: false,
    }));
    return;
  }

  requireCondition(entries.length === expected.checkpoint_version, 'Phase 10H requires the exact Phase 10G checkpoint version.');
  requireCondition(latest?.action === 'instructional-review-recorded' && latest?.state === 'instructionally_reviewed', 'Final approval requires the instructionally_reviewed state.');
  requireCondition(latest.metadata?.reviewEvidenceHash === expected.instructional_review_evidence_hash, 'Governed Phase 10G review evidence hash mismatch.');
  requireCondition(latest.metadata?.payloadSha256 === expected.payload_sha256, 'Governed Phase 10G payload hash mismatch.');
  requireCondition(latest.metadata?.citationSetHash === expected.citation_set_hash, 'Governed Phase 10G citation-set hash mismatch.');
  requireCondition(latest.metadata?.citationValidationEvidenceHash === expected.citation_validation_evidence_hash, 'Governed Phase 10G citation-validation evidence hash mismatch.');
  requireCondition(latest.metadata?.reviewerIdentity === provenance.instructional_reviewer_id, 'Governed instructional reviewer does not match provenance.');
  requireCondition(latest.metadata?.technicalReviewerIdentity === provenance.technical_reviewer_id, 'Governed technical reviewer does not match provenance.');

  const approvalPersistedLedgerMissing =
    provenance.status === 'approved' &&
    Boolean(provenance.approved_by) &&
    Boolean(provenance.approved_at) &&
    latest.action === 'instructional-review-recorded' &&
    latest.state === 'instructionally_reviewed';

  const validatedApprovalPreparation =
    provenance.status === 'validated' &&
    !provenance.approved_by &&
    !provenance.approved_at &&
    checklist.final_approval_decision === 'approve' &&
    checklist.final_approval_payload_sha256 === expectedPayloadSha &&
    checklist.final_approval_reviewer_id === reviewerId;

  if (approvalPersistedLedgerMissing) {
    requireCondition(decision === 'approve', 'A persisted final approval may only recover the missing governed ledger transition.');
    requireCondition(provenance.approved_by === reviewerId, 'Persisted final approver identity mismatch.');
    requireCondition(checklist.final_approval_decision === 'approve', 'Persisted final approval decision is not approve.');
    requireCondition(checklist.final_approval_payload_sha256 === expectedPayloadSha, 'Persisted final approval payload mismatch.');
    requireCondition(checklist.final_approval_instructional_review_evidence_hash === expected.instructional_review_evidence_hash, 'Persisted final approval Phase 10G evidence mismatch.');
    requireCondition(typeof checklist.final_approval_submitted_by === 'string' && checklist.final_approval_submitted_by.length > 0, 'Persisted final approval submission actor is missing.');
  } else if (provenance.status === 'validated') {
    requireCondition(decision === 'approve', 'Validated final-approval preparation may only resume the same approve decision.');
    requireCondition(validatedApprovalPreparation, 'Validated provenance is not bound to the current final approver and payload.');
    requireCondition(checklist.final_approval_instructional_review_evidence_hash === expected.instructional_review_evidence_hash, 'Validated final-approval preparation Phase 10G evidence mismatch.');
    requireCondition(typeof checklist.final_approval_reviewed_at === 'string' && checklist.final_approval_reviewed_at.length > 0, 'Validated final-approval preparation timestamp is missing.');
    requireCondition(typeof checklist.final_approval_submitted_by === 'string' && checklist.final_approval_submitted_by.length > 0, 'Validated final-approval preparation submission actor is missing.');
  } else {
    requireCondition(provenance.status === 'draft', 'Final approval requires draft provenance before the first approval.');
    requireCondition(!provenance.approved_by && !provenance.approved_at, 'Final approval cannot overwrite an existing approval.');
  }

  if (
    checklist.final_approval_payload_sha256 === expectedPayloadSha &&
    checklist.final_approval_decision === 'reject' &&
    decision === 'approve'
  ) {
    throw new Error('A prior final rejection exists for this exact payload; revise the content before attempting approval.');
  }

  const { data: reviewer, error: reviewerError } = await client
    .from('profiles')
    .select('id,role')
    .eq('id', reviewerId)
    .maybeSingle();
  if (reviewerError) throw reviewerError;
  requireCondition(reviewer, 'Final approver profile does not exist in production.');
  requireCondition(
    reviewer.role === contract.governance_constants.FINAL_APPROVER_REQUIRED_ROLE,
    'Reviewer profile role is not eligible for final content approval.'
  );
  requireCondition(reviewerId !== provenance.technical_reviewer_id, 'Final approver must be independent from the technical reviewer.');
  requireCondition(reviewerId !== provenance.instructional_reviewer_id, 'Final approver must be independent from the instructional reviewer.');

  const { data: reviewerAuth, error: reviewerAuthError } = await client.auth.admin.getUserById(reviewerId);
  if (reviewerAuthError) throw reviewerAuthError;
  requireCondition(reviewerAuth?.user, 'Final approver Auth identity does not exist.');
  requireCondition(reviewerAuth.user.email_confirmed_at, 'Final approver email confirmation is required before approval.');
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_role === contract.governance_constants.FINAL_APPROVER_REQUIRED_ROLE,
    'Final approver Auth governance role does not match the canonical profile role.'
  );
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_scope === contract.governance_constants.FINAL_APPROVER_REQUIRED_SCOPE,
    'Final approver Auth governance scope is not authorized for native final approval.'
  );

  const preContainment = await readContainment(client, question.question_id);
  requireCondition(preContainment.scenarioQuestionCount === 0, 'Final approval requires zero public scenario_questions rows before the transition.');
  requireCondition(preContainment.assessmentEligibilityCount === 0, 'Final approval requires zero assessment eligibility rows before the transition.');

  const reviewedAt = approvalPersistedLedgerMissing
    ? provenance.approved_at
    : validatedApprovalPreparation
      ? checklist.final_approval_reviewed_at
      : new Date().toISOString();
  const effectiveSubmittedBy = (approvalPersistedLedgerMissing || validatedApprovalPreparation)
    ? checklist.final_approval_submitted_by
    : submittedBy;
  const { evidence, evidenceHash } = buildFinalContentApprovalEvidence({
    provenanceId: provenance.id,
    questionId: question.question_id,
    payloadSha256: expectedPayloadSha,
    citationSetHash: latest.metadata.citationSetHash,
    citationValidationEvidenceHash: latest.metadata.citationValidationEvidenceHash,
    instructionalReviewEvidenceHash: latest.metadata.reviewEvidenceHash,
    reviewerId,
    approverRole: reviewer.role,
    approverScope: reviewerAuth.user.app_metadata.governance_scope,
    technicalReviewerId: provenance.technical_reviewer_id,
    instructionalReviewerId: provenance.instructional_reviewer_id,
    reviewedAt,
    decision,
    checklistCompleted,
    submittedBy: effectiveSubmittedBy,
    contract,
  });

  assertInstructionalReviewEvidenceBinding({
    provenanceId: provenance.id,
    questionId: question.question_id,
    approvalEvidence: evidence,
    latestEntry: latest,
  });

  const finalChecklist = {
    ...checklist,
    sources_linked: true,
    citations_validated: true,
    answer_verified: true,
    explanation_verified: true,
    citation_matches_excerpt: true,
    license_ok: true,
    final_approval_complete: decision === 'approve',
    final_approval_decision: decision,
    final_approval_payload_sha256: expectedPayloadSha,
    final_approval_citation_set_hash: latest.metadata.citationSetHash,
    final_approval_citation_validation_evidence_hash: latest.metadata.citationValidationEvidenceHash,
    final_approval_instructional_review_evidence_hash: latest.metadata.reviewEvidenceHash,
    final_approval_reviewer_id: reviewerId,
    final_approval_reviewer_role: reviewer.role,
    final_approval_reviewer_scope: reviewerAuth.user.app_metadata.governance_scope,
    final_approval_reviewed_at: reviewedAt,
    final_approval_submitted_by: effectiveSubmittedBy,
    final_approval_checklist_version: evidence.checklistVersion,
    final_approval_checklist_completed: evidence.checklistCompleted,
    final_approval_checklist_criteria: evidence.checklistCriteria,
    final_approval_all_criteria_passed: evidence.allCriteriaPassed,
    final_approval_evidence_hash: evidenceHash,
  };

  const note = [
    `[native-final-content-approval] decision=${decision}`,
    `reviewer=${reviewerId}`,
    `payload_sha256=${expectedPayloadSha}`,
    `instructional_review_evidence_hash=${latest.metadata.reviewEvidenceHash}`,
    `submitted_by=${submittedBy}`,
    decision === 'approve'
      ? 'Human final content approval granted for governed instructional content only; assessment, scoring, delivery, and release remain unauthorized.'
      : 'Human final content approval rejected; governed state remains instructionally_reviewed and no approval authority is created.',
  ].join(' ');

  if (decision === 'reject') {
    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        validation_checklist: finalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'draft')
      .is('approved_by', null)
      .select('id,status,approved_by,approved_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Final approval rejection write lost an optimistic concurrency race.');
    requireCondition(updated.status === 'draft' && !updated.approved_by && !updated.approved_at, 'Rejected final approval must not approve provenance.');

    console.log(JSON.stringify({
      runId,
      questionId: question.question_id,
      provenanceId: provenance.id,
      decision: 'reject',
      state: 'instructionally_reviewed',
      advanced: false,
      humanFinalDecisionCaptured: true,
      humanApproval: false,
      publicScenarioQuestionRows: preContainment.scenarioQuestionCount,
      assessmentEligibilityRows: preContainment.assessmentEligibilityCount,
      releasedForAssessment: false,
      scoredDeliveryAuthority: false,
      deliveryAuthority: false,
      releaseAuthority: false,
    }));
    return;
  }

  if (approvalPersistedLedgerMissing) {
    requireCondition(
      checklist.final_approval_evidence_hash === evidenceHash,
      'Persisted final approval evidence hash does not match reconstructed approval evidence.'
    );
  } else {
    if (validatedApprovalPreparation) {
      requireCondition(
        checklist.final_approval_evidence_hash === evidenceHash,
        'Validated final-approval preparation evidence hash does not match reconstructed approval evidence.'
      );
    } else {
      const { data: prepared, error: prepareError } = await client
        .from('question_provenance')
        .update({
          status: 'validated',
          validation_checklist: finalChecklist,
        })
        .eq('id', provenance.id)
        .eq('status', 'draft')
        .is('approved_by', null)
        .eq('instructional_reviewer_id', provenance.instructional_reviewer_id)
        .select('id,status,approved_by,approved_at,validation_checklist')
        .maybeSingle();
      if (prepareError) throw prepareError;
      requireCondition(prepared, 'Final approval validation preparation lost an optimistic concurrency race.');
      requireCondition(
        prepared.status === 'validated' && !prepared.approved_by && !prepared.approved_at,
        'Final approval validation preparation must not approve provenance.'
      );
    }

    const { data: updated, error: updateError } = await client
      .from('question_provenance')
      .update({
        status: 'approved',
        approved_by: reviewerId,
        approved_at: reviewedAt,
        validation_checklist: finalChecklist,
        notes: appendNote(provenance.notes, note),
      })
      .eq('id', provenance.id)
      .eq('status', 'validated')
      .is('approved_by', null)
      .eq('instructional_reviewer_id', provenance.instructional_reviewer_id)
      .select('id,status,approved_by,approved_at,validation_checklist')
      .maybeSingle();
    if (updateError) throw updateError;
    requireCondition(updated, 'Final approval write lost an optimistic concurrency race.');
  }

  await runtime.governanceRuntime.recordFinalContentApproval({
    runId,
    provenanceId: provenance.id,
    questionId: question.question_id,
    approvalEvidenceHash: evidenceHash,
    approvalEvidence: evidence,
  });

  const finalEntries = await runtime.governanceRuntime.getRun(runId);
  const finalApprovalEntries = finalEntries.filter((entry) => entry.action === 'final-content-approval-recorded');
  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);

  const { data: finalProvenance, error: finalProvenanceError } = await client
    .from('question_provenance')
    .select('id,status,validation_checklist,technical_reviewer_id,technical_reviewed_at,instructional_reviewer_id,instructional_reviewed_at,approved_by,approved_at')
    .eq('id', provenance.id)
    .maybeSingle();
  if (finalProvenanceError) throw finalProvenanceError;

  const postContainment = await readContainment(client, question.question_id);
  assertFinalContentApprovalContainment({
    ...postContainment,
    provenance: finalProvenance,
    reviewerId,
  });

  requireCondition(finalProvenance.validation_checklist?.final_approval_evidence_hash === evidenceHash, 'Final approval evidence hash was not persisted.');
  requireCondition(finalApprovalEntries.length === 1, 'Expected exactly one governed final-content approval transition.');
  requireCondition(
    checkpoint?.version === 7 &&
    checkpoint?.state === 'final_content_approved' &&
    checkpoint?.action === 'final-content-approval-recorded' &&
    checkpoint?.status === 'final-content-approved',
    'Governed final-content approval checkpoint verification failed.'
  );

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    decision: 'approve',
    state: checkpoint.state,
    version: checkpoint.version,
    status: checkpoint.status,
    payloadSha256: expectedPayloadSha,
    citationSetHash: latest.metadata.citationSetHash,
    citationValidationEvidenceHash: latest.metadata.citationValidationEvidenceHash,
    instructionalReviewEvidenceHash: latest.metadata.reviewEvidenceHash,
    finalApproverRole: reviewer.role,
    finalApproverScope: reviewerAuth.user.app_metadata.governance_scope,
    independentFromTechnicalReviewer: reviewerId !== provenance.technical_reviewer_id,
    independentFromInstructionalReviewer: reviewerId !== provenance.instructional_reviewer_id,
    humanFinalDecisionCaptured: true,
    agentSynthesizedDecision: false,
    humanApproval: true,
    publicScenarioQuestionRows: postContainment.scenarioQuestionCount,
    assessmentEligibilityRows: postContainment.assessmentEligibilityCount,
    releasedForAssessment: false,
    scoredDeliveryAuthority: false,
    deliveryAuthority: false,
    releaseAuthority: false,
  }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
