'use strict';

const { createClient } = require('@supabase/supabase-js');
const contract = require('../data/architecture/agent-orchestration-native-publication.json');
const { createProductionAIOrchestrator } = require('../src/ai/runtime/production-ai-runtime');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');
const { parsePrivateDraftPayload } = require('../src/ai/runtime/native-evidence-mapping');
const {
  assertNativePublicationActivationGate,
  buildPublicationEvidence,
  assertPhase10HEvidenceBinding,
  buildScenarioQuestionRow,
  assertExactPublishedRow,
  assertPublicationContainment,
} = require('../src/ai/runtime/native-question-publication');

const scenarioId = process.env.PUBLICATION_SCENARIO_ID || '';
const runId = process.env.PUBLICATION_RUN_ID || '';
const reviewerId = process.env.PUBLICATION_REVIEWER_ID || '';
const expectedPayloadSha = (process.env.PUBLICATION_PAYLOAD_SHA256 || '').toLowerCase();
const decision = (process.env.PUBLICATION_DECISION || '').toLowerCase();
const checklistCompleted = process.env.PUBLICATION_CHECKLIST_COMPLETED === 'true';
const submittedBy = process.env.GITHUB_ACTOR || process.env.PUBLICATION_SUBMITTED_BY || '';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readPublicRows(client, questionId) {
  const { data, error } = await client
    .from('scenario_questions')
    .select('id,scenario_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,topic,ase_area')
    .eq('question_id', questionId);
  if (error) throw error;
  return data || [];
}

async function readEligibilityCount(client, publicRows) {
  if (!publicRows.length) return 0;
  const { count, error } = await client
    .from('assessment_question_eligibility')
    .select('question_id', { count: 'exact', head: true })
    .in('question_id', publicRows.map((row) => row.id));
  if (error) throw error;
  return count || 0;
}

(async () => {
  assertNativePublicationActivationGate(contract);
  requireCondition(process.env.TORQUEMIND_ENVIRONMENT === 'production', 'Native publication is production-only.');
  requireCondition(/^[a-z0-9-]+$/.test(scenarioId), 'A valid scenario_id is required.');
  requireCondition(/^[A-Za-z0-9._:-]+$/.test(runId), 'A valid governed_run_id is required.');
  requireCondition(/^[0-9a-f-]{36}$/i.test(reviewerId), 'A valid publication approver UUID is required.');
  requireCondition(/^[0-9a-f]{64}$/.test(expectedPayloadSha), 'A valid reviewed payload SHA-256 is required.');
  requireCondition(['approve', 'reject'].includes(decision), 'Publication decision must be approve or reject.');
  requireCondition(checklistCompleted, 'The human publication checklist must be completed before recording a decision.');
  requireCondition(submittedBy.length > 0, 'GitHub submission actor is required.');

  const expected = contract.referenced_10H_evidence;
  requireCondition(runId === expected.governed_run_id, 'Phase 10I run ID does not match the approved Phase 10H control point.');
  requireCondition(scenarioId === 'charging-system', 'Phase 10I activation is scoped to the charging-system governed run.');
  requireCondition(expectedPayloadSha === expected.payload_sha256, 'Phase 10I payload hash does not match the approved Phase 10H control point.');

  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: ['github-actions', process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', 'native-question-publication'].join(':'),
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
  requireCondition(privateDraft.payload_sha256 === expectedPayloadSha, 'Publication payload hash does not match the private draft.');

  const document = parsePrivateDraftPayload(privateDraft.payload_text, privateDraft.payload_sha256);
  const question = validateNativeDraftArtifact(document, { scenarioId });
  requireCondition(question.question_id === privateDraft.question_id, 'Private native draft question identity mismatch.');
  requireCondition(question.question_id === expected.question_id, 'Question ID does not match the approved Phase 10H control point.');

  const { data: provenance, error: provenanceError } = await client
    .from('question_provenance')
    .select('id,question_id,status,validation_checklist,approved_by,approved_at')
    .eq('id', expected.provenance_id)
    .maybeSingle();
  if (provenanceError) throw provenanceError;
  requireCondition(provenance, 'Approved question provenance does not exist.');

  const entries = await runtime.governanceRuntime.getRun(runId);
  const latest = entries.length ? entries[entries.length - 1] : null;
  assertPhase10HEvidenceBinding({
    contract,
    provenance,
    latestEntry: latest,
    questionId: question.question_id,
    payloadSha256: expectedPayloadSha,
  });

  const { data: reviewer, error: reviewerError } = await client
    .from('profiles')
    .select('id,role')
    .eq('id', reviewerId)
    .maybeSingle();
  if (reviewerError) throw reviewerError;
  requireCondition(reviewer, 'Publication approver profile does not exist in production.');
  requireCondition(
    reviewer.role === contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_ROLE,
    'Reviewer profile role is not eligible for native publication.'
  );
  requireCondition(
    reviewerId !== expected.final_approver_id,
    'Publication approver must be independent from the final content approver.'
  );

  const { data: reviewerAuth, error: reviewerAuthError } = await client.auth.admin.getUserById(reviewerId);
  if (reviewerAuthError) throw reviewerAuthError;
  requireCondition(reviewerAuth?.user, 'Publication approver Auth identity does not exist.');
  requireCondition(reviewerAuth.user.email_confirmed_at, 'Publication approver email confirmation is required before publication.');
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_role === contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_ROLE,
    'Publication approver Auth governance role does not match the canonical profile role.'
  );
  requireCondition(
    reviewerAuth.user.app_metadata?.governance_scope === contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_SCOPE,
    'Publication approver Auth governance scope is not authorized for native publication.'
  );

  const reviewedAt = new Date().toISOString();
  const { evidence, evidenceHash } = buildPublicationEvidence({
    provenanceId: provenance.id,
    questionId: question.question_id,
    scenarioId,
    payloadSha256: expectedPayloadSha,
    finalApprovalEvidenceHash: expected.final_approval_evidence_hash,
    reviewerId,
    approverRole: reviewer.role,
    approverScope: reviewerAuth.user.app_metadata.governance_scope,
    finalApproverId: expected.final_approver_id,
    reviewedAt,
    decision,
    checklistCompleted,
    submittedBy,
    contract,
  });

  const expectedRow = buildScenarioQuestionRow(question);
  const beforeRows = await readPublicRows(client, question.question_id);
  const beforeEligibility = await readEligibilityCount(client, beforeRows);
  requireCondition(beforeEligibility === 0, 'Native publication requires zero assessment eligibility rows before the decision.');
  requireCondition(beforeRows.length <= 1, 'Native publication found duplicate public scenario question rows.');

  if (decision === 'reject') {
    requireCondition(beforeRows.length === 0, 'A publication rejection cannot overwrite an existing public question.');
    console.log(JSON.stringify({
      runId,
      questionId: question.question_id,
      provenanceId: provenance.id,
      decision: 'reject',
      advanced: false,
      humanPublicationDecisionCaptured: true,
      humanApproval: false,
      publicationEvidenceHash: evidenceHash,
      publicScenarioQuestionRows: 0,
      assessmentEligibilityRows: 0,
      assessmentEligible: false,
      scoredDeliveryAuthority: false,
      deliveryAuthority: false,
      gradingAuthority: false,
      institutionalAssessmentEligible: false,
      highStakesEligible: false,
      certificationEligible: false,
      productionAssessmentApiEligible: false,
      assessmentRelease: false,
      broadProductionRelease: false,
    }));
    return;
  }

  let publishedRows = beforeRows;
  let idempotent = false;
  if (publishedRows.length === 1) {
    assertExactPublishedRow(publishedRows[0], expectedRow);
    idempotent = true;
  } else {
    const { data: inserted, error: insertError } = await client
      .from('scenario_questions')
      .insert(expectedRow)
      .select('id,scenario_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,difficulty,topic,ase_area')
      .single();
    if (insertError) throw insertError;
    publishedRows = [inserted];
  }

  const assessmentEligibilityCount = await readEligibilityCount(client, publishedRows);
  assertPublicationContainment({
    publicRows: publishedRows,
    assessmentEligibilityCount,
    expectedRow,
  });

  console.log(JSON.stringify({
    runId,
    questionId: question.question_id,
    provenanceId: provenance.id,
    decision: 'approve',
    publicationTarget: evidence.publicationTarget,
    publicationEvidenceHash: evidenceHash,
    publicationApproverRole: reviewer.role,
    publicationApproverScope: reviewerAuth.user.app_metadata.governance_scope,
    independentFromFinalContentApprover: reviewerId !== expected.final_approver_id,
    humanPublicationDecisionCaptured: true,
    agentSynthesizedDecision: false,
    humanApproval: true,
    idempotent,
    publicScenarioQuestionRows: publishedRows.length,
    assessmentEligibilityRows: assessmentEligibilityCount,
    assessmentEligible: false,
    scoredDeliveryAuthority: false,
    deliveryAuthority: false,
    gradingAuthority: false,
    institutionalAssessmentEligible: false,
    highStakesEligible: false,
    certificationEligible: false,
    productionAssessmentApiEligible: false,
    assessmentRelease: false,
    broadProductionRelease: false,
  }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
