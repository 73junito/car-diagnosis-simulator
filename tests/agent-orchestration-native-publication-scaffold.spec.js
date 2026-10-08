'use strict';

const fs = require('fs');
const path = require('path');

const {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  NATIVE_PUBLICATION_ACTIVE_STATUS,
  collectUnresolvedPublicationGovernance,
  assertNativePublicationActivationGate,
  assertPublicationIndependence,
  stablePublicationEvidenceHash,
  buildPublicationEvidence,
  assertPhase10HEvidenceBinding,
  buildScenarioQuestionRow,
  assertExactPublishedRow,
  assertPublicationContainment,
} = require('../src/ai/runtime/native-question-publication');

const contractPath = path.join(__dirname, '..', 'data', 'architecture', 'agent-orchestration-native-publication.json');
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'record-native-question-publication.yml');
const scriptPath = path.join(__dirname, '..', 'scripts', 'record-native-question-publication.js');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

const RUN_ID = 'native-draft:37418457881:charging-system';
const PROVENANCE_ID = 'c3b07430-db49-4216-9878-c3efb4ab0a54';
const QUESTION_ID = 'charging-system-ai-draft-e9ac4b22b122';
const PAYLOAD_SHA = '1b833a88a6fc8a0a79feaaa3f8848ac4b8cb3573f158effa0a6593bebf7cf10e';
const FINAL_APPROVAL_HASH = 'be5e7646827acfc26fc1f7d9d673f832622dab5b0838d0eadc8862db644f95fc';
const FINAL_APPROVER_ID = '3739032e-01bc-48ca-b211-1ecdef38dbeb';
const PUBLICATION_APPROVER_ID = '2f14c3d5-6f9b-4f69-8f9f-3f6a9a1b2c3d';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildEvidence(overrides = {}) {
  return buildPublicationEvidence({
    provenanceId: PROVENANCE_ID,
    questionId: QUESTION_ID,
    scenarioId: 'charging-system',
    payloadSha256: PAYLOAD_SHA,
    finalApprovalEvidenceHash: FINAL_APPROVAL_HASH,
    reviewerId: PUBLICATION_APPROVER_ID,
    approverRole: 'publication_approver',
    approverScope: 'native-question-publication',
    finalApproverId: FINAL_APPROVER_ID,
    reviewedAt: '2026-10-08T04:05:00.000Z',
    decision: 'approve',
    checklistCompleted: true,
    submittedBy: 'phase10i-activation-test',
    contract,
    ...overrides,
  });
}

function approvedProvenance() {
  return {
    id: PROVENANCE_ID,
    question_id: QUESTION_ID,
    status: 'approved',
    approved_by: FINAL_APPROVER_ID,
    approved_at: '2026-10-08T03:46:51.964Z',
    validation_checklist: {
      final_approval_evidence_hash: FINAL_APPROVAL_HASH,
    },
  };
}

function finalApprovalEntry() {
  return {
    version: 7,
    action: 'final-content-approval-recorded',
    state: 'final_content_approved',
    metadata: {
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: FINAL_APPROVAL_HASH,
      payloadSha256: PAYLOAD_SHA,
      approverIdentity: FINAL_APPROVER_ID,
      humanApproval: true,
      agentSynthesizedDecision: false,
    },
  };
}

function nativeQuestion() {
  return {
    question_id: QUESTION_ID,
    scenario_slug: 'charging-system',
    question: 'Which charging-system component rectifies generated AC into DC for vehicle electrical use?',
    options: {
      A: 'Rectifier diodes',
      B: 'Voltage regulator sensing circuit',
      C: 'Rotor field winding',
      D: 'Drive belt tensioner',
    },
    correct_answer: 'A',
    explanation: 'Rectifier diodes convert the alternator stator output from AC to DC for the vehicle electrical system.',
    difficulty: 'medium',
    topic: 'charging-system',
    ase_area: null,
  };
}

describe('Phase 10I governance resolution contract', () => {
  test('resolves the approved publication role, scope, independence, checklist, and target exactly', () => {
    expect(contract.status).toBe(NATIVE_PUBLICATION_ACTIVE_STATUS);
    expect(contract.governance_constants).toEqual({
      PUBLICATION_APPROVER_REQUIRED_ROLE: 'publication_approver',
      PUBLICATION_APPROVER_REQUIRED_SCOPE: 'native-question-publication',
      independencePolicy: {
        independentFromFinalContentApprover: true,
      },
      checklistVersion: 'native-question-publication-v1',
      checklistCriteria: [
        'exact-phase10h-approved-payload-and-evidence-binding',
        'approved-provenance-and-ledger-v7-binding',
        'exact-question-identity-and-scenario-binding-preserved',
        'approved-rights-and-citation-evidence-remain-valid',
        'exactly-one-public-scenario-question-row',
        'zero-assessment-eligibility-rows',
        'no-scoring-grading-assessment-delivery-certification-high-stakes-api-or-broader-release-authority',
        'blocked-claims-02-and-12-remain-excluded',
      ],
      publicationTarget: 'scenario_questions',
    });
    expect(contract.unresolved_governance_decisions).toEqual([]);
    expect(collectUnresolvedPublicationGovernance(contract)).toEqual([]);
    expect(() => assertNativePublicationActivationGate(contract)).not.toThrow();
  });

  test('activation gate remains fail-closed for unresolved constants or wrong status', () => {
    const unresolved = clone(contract);
    unresolved.governance_constants.PUBLICATION_APPROVER_REQUIRED_ROLE = UNRESOLVED_GOVERNANCE_SENTINEL;
    expect(() => assertNativePublicationActivationGate(unresolved)).toThrow(/unresolved governance decisions/);

    const wrongStatus = clone(contract);
    wrongStatus.status = 'draft-non-dispatchable';
    expect(() => assertNativePublicationActivationGate(wrongStatus)).toThrow(/not activation-ready/);
  });

  test('binds the exact successful Phase 10H control point', () => {
    expect(contract.control_commit).toBe('1fa26895bb68d7b8ff79e71566ad160db15174eb');
    expect(contract.referenced_10H_evidence).toMatchObject({
      governed_run_id: RUN_ID,
      github_actions_run_id: 37724308574,
      checkpoint_version: 7,
      state: 'final_content_approved',
      status: 'final-content-approved',
      question_id: QUESTION_ID,
      provenance_id: PROVENANCE_ID,
      payload_sha256: PAYLOAD_SHA,
      final_approval_evidence_hash: FINAL_APPROVAL_HASH,
      final_approver_id: FINAL_APPROVER_ID,
      human_final_decision: 'approve',
      human_approval: true,
      agent_synthesized_decision: false,
    });
  });

  test('allows only the public question write and preserves the assessment boundary', () => {
    expect(contract.storage_boundary).toEqual({
      public_scenario_questions_write_on_approval: true,
      assessment_eligibility_write: false,
      question_provenance_write: false,
      orchestration_ledger_write: false,
      citation_validation_write: false,
    });
    expect(contract.required_containment_after_10i_approval).toMatchObject({
      public_scenario_question_rows_for_exact_question: 1,
      assessment_eligibility_rows_for_exact_question: 0,
      assessment_eligible: false,
      scored_delivery_authority: false,
      grading_authority: false,
      production_assessment_api_eligible: false,
      assessment_release: false,
      broad_production_release: false,
      claims_02_and_12_blocked: true,
    });
  });
});

describe('Phase 10I publication evidence and containment', () => {
  test('builds deterministic human publication evidence with the approved contract values', () => {
    const first = buildEvidence();
    const second = buildEvidence();
    expect(first).toEqual(second);
    expect(first.evidenceHash).toBe(stablePublicationEvidenceHash(first.evidence));
    expect(first.evidence).toMatchObject({
      reviewerId: PUBLICATION_APPROVER_ID,
      approverRole: 'publication_approver',
      approverScope: 'native-question-publication',
      publicationTarget: 'scenario_questions',
      checklistVersion: 'native-question-publication-v1',
      checklistCompleted: true,
      allCriteriaPassed: true,
      decision: 'approve',
    });
  });

  test('enforces publication approver independence from the Phase 10H final approver', () => {
    expect(() => assertPublicationIndependence({
      contract,
      publicationApproverId: PUBLICATION_APPROVER_ID,
      finalApproverId: FINAL_APPROVER_ID,
    })).not.toThrow();

    expect(() => assertPublicationIndependence({
      contract,
      publicationApproverId: FINAL_APPROVER_ID,
      finalApproverId: FINAL_APPROVER_ID,
    })).toThrow(/independent from the final content approver/);
  });

  test('requires exact Phase 10H approved provenance and governed ledger evidence', () => {
    expect(() => assertPhase10HEvidenceBinding({
      contract,
      provenance: approvedProvenance(),
      latestEntry: finalApprovalEntry(),
      questionId: QUESTION_ID,
      payloadSha256: PAYLOAD_SHA,
    })).not.toThrow();

    const drifted = finalApprovalEntry();
    drifted.metadata.approvalEvidenceHash = 'f'.repeat(64);
    expect(() => assertPhase10HEvidenceBinding({
      contract,
      provenance: approvedProvenance(),
      latestEntry: drifted,
      questionId: QUESTION_ID,
      payloadSha256: PAYLOAD_SHA,
    })).toThrow(/evidence hash/);
  });

  test('builds the exact public scenario row without creating assessment metadata', () => {
    const row = buildScenarioQuestionRow(nativeQuestion());
    expect(row).toEqual({
      scenario_id: 'charging-system',
      question_id: QUESTION_ID,
      question_text: nativeQuestion().question,
      option_a: nativeQuestion().options.A,
      option_b: nativeQuestion().options.B,
      option_c: nativeQuestion().options.C,
      option_d: nativeQuestion().options.D,
      correct_answer: 'A',
      explanation: nativeQuestion().explanation,
      difficulty: 'medium',
      topic: 'charging-system',
      ase_area: null,
    });
  });

  test('publication containment requires exactly one exact public row and zero eligibility rows', () => {
    const expectedRow = buildScenarioQuestionRow(nativeQuestion());
    expect(() => assertPublicationContainment({
      publicRows: [{ id: 'public-row-id', ...expectedRow }],
      assessmentEligibilityCount: 0,
      expectedRow,
    })).not.toThrow();

    expect(() => assertPublicationContainment({
      publicRows: [{ id: 'public-row-id', ...expectedRow }],
      assessmentEligibilityCount: 1,
      expectedRow,
    })).toThrow(/must not create assessment eligibility/);

    expect(() => assertExactPublishedRow(
      { ...expectedRow, option_d: 'drift' },
      expectedRow
    )).toThrow(/option_d/);
  });
});

describe('Phase 10I production activation surfaces', () => {
  test('workflow is manual-only and binds explicit human decision inputs', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('PUBLICATION_REVIEWER_ID: ${{ inputs.reviewer_id }}');
    expect(workflow).toContain('PUBLICATION_DECISION: ${{ inputs.decision }}');
    expect(workflow).toContain('PUBLICATION_CHECKLIST_COMPLETED: ${{ inputs.checklist_completed }}');
    expect(workflow).not.toContain('schedule:');
    expect(workflow).not.toContain('comments:');
  });

  test('production script verifies profile/Auth authority and the exact Phase 10H control point', () => {
    expect(scriptSource).toContain(".from('profiles')");
    expect(scriptSource).toContain('client.auth.admin.getUserById(reviewerId)');
    expect(scriptSource).toContain('PUBLICATION_APPROVER_REQUIRED_ROLE');
    expect(scriptSource).toContain('PUBLICATION_APPROVER_REQUIRED_SCOPE');
    expect(scriptSource).toContain('assertPhase10HEvidenceBinding');
    expect(scriptSource).toContain('final_approval_evidence_hash');
    expect(scriptSource).toContain('reviewerId !== expected.final_approver_id');
    expect(scriptSource).toContain('email_confirmed_at');
  });

  test('approval writes only scenario_questions while assessment eligibility stays read-only', () => {
    expect(scriptSource).toMatch(/\.from\('scenario_questions'\)[\s\S]{0,500}\.insert\(expectedRow\)/);
    expect(scriptSource).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\(/);
    expect(scriptSource).not.toMatch(/\.from\('question_provenance'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\(/);
    expect(scriptSource).not.toMatch(/\.from\('citation_validations'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\(/);
  });

  test('reject decision performs no publication write and carries no downstream authority', () => {
    expect(scriptSource).toContain("decision === 'reject'");
    expect(scriptSource).toContain('humanPublicationDecisionCaptured: true');
    expect(scriptSource).toContain('assessmentEligible: false');
    expect(scriptSource).toContain('scoredDeliveryAuthority: false');
    expect(scriptSource).toContain('gradingAuthority: false');
    expect(scriptSource).toContain('productionAssessmentApiEligible: false');
    expect(scriptSource).toContain('assessmentRelease: false');
    expect(scriptSource).toContain('broadProductionRelease: false');
  });
});
