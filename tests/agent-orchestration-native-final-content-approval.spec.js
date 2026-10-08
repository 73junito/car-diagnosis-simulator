'use strict';

const fs = require('fs');
const path = require('path');

const PersistentGovernanceRuntime = require('../src/ai/runtime/persistent-governance-runtime');
const {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  FINAL_CONTENT_APPROVAL_ACTIVE_STATUS,
  collectUnresolvedGovernanceDecisions,
  assertFinalContentApprovalActivationGate,
  assertApprovedIndependencePolicy,
  stableFinalContentApprovalEvidenceHash,
  assertFinalContentApprovalEvidenceContract,
  buildFinalContentApprovalEvidence,
  assertInstructionalReviewEvidenceBinding,
  assertFinalContentApprovalContainment,
} = require('../src/ai/runtime/native-final-content-approval');

const contractPath = path.join(__dirname, '..', 'data', 'architecture', 'agent-orchestration-native-final-content-approval.json');
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'record-native-question-final-approval.yml');
const scriptPath = path.join(__dirname, '..', 'scripts', 'record-native-question-final-approval.js');
const coordinatorPath = path.join(__dirname, '..', 'src', 'ai', 'governance', 'production-run-coordinator.js');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const coordinatorSource = fs.readFileSync(coordinatorPath, 'utf8');

const RUN_ID = 'native-draft:37418457881:charging-system';
const PROVENANCE_ID = 'c3b07430-db49-4216-9878-c3efb4ab0a54';
const QUESTION_ID = 'charging-system-ai-draft-e9ac4b22b122';
const PAYLOAD_SHA = '1b833a88a6fc8a0a79feaaa3f8848ac4b8cb3573f158effa0a6593bebf7cf10e';
const CITATION_SET_HASH = '47bf8234e313be166026771ccf5cd6ab59b62f917422a51ce347eeaa6bb88a32';
const CITATION_VALIDATION_HASH = '01a5a2a2f34fc47ca16417f8bfca43ff659aacaf8f0fa1b5dc930a3269617a3c';
const INSTRUCTIONAL_REVIEW_HASH = '68e06d5c99638bd6361d919eca0454261231c9f1fa8ab44fdc54f44e0841aecb';
const TECHNICAL_REVIEWER_ID = '296a1f4f-17a4-4df8-b1e0-d16b72ce8e0f';
const INSTRUCTIONAL_REVIEWER_ID = '6f3a699d-eadd-41b5-863f-8688dc02c731';
const FINAL_APPROVER_ID = '2f14c3d5-6f9b-4f69-8f9f-3f6a9a1b2c3d';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStubCoordinator(entries = [], appends = [], reads = []) {
  return {
    store: {
      loadEntries: async (...args) => {
        reads.push({ method: 'loadEntries', args });
        return entries;
      },
    },
    append: async (entry) => {
      appends.push(entry);
      return entry;
    },
    recover: async (...args) => {
      reads.push({ method: 'recover', args });
      return null;
    },
  };
}

function buildEvidence(overrides = {}) {
  return buildFinalContentApprovalEvidence({
    provenanceId: PROVENANCE_ID,
    questionId: QUESTION_ID,
    payloadSha256: PAYLOAD_SHA,
    citationSetHash: CITATION_SET_HASH,
    citationValidationEvidenceHash: CITATION_VALIDATION_HASH,
    instructionalReviewEvidenceHash: INSTRUCTIONAL_REVIEW_HASH,
    reviewerId: FINAL_APPROVER_ID,
    approverRole: 'final_approver',
    approverScope: 'native-question-final-approval',
    technicalReviewerId: TECHNICAL_REVIEWER_ID,
    instructionalReviewerId: INSTRUCTIONAL_REVIEWER_ID,
    reviewedAt: '2026-10-08T02:15:00.000Z',
    decision: 'approve',
    checklistCompleted: true,
    submittedBy: 'phase10h-activation-test',
    contract,
    ...overrides,
  });
}

function priorInstructionalEntry() {
  return {
    runId: RUN_ID,
    actor: 'instructional-review-agent',
    action: 'instructional-review-recorded',
    state: 'instructionally_reviewed',
    metadata: {
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      reviewEvidenceHash: INSTRUCTIONAL_REVIEW_HASH,
      reviewerIdentity: INSTRUCTIONAL_REVIEWER_ID,
      technicalReviewerIdentity: TECHNICAL_REVIEWER_ID,
      payloadSha256: PAYLOAD_SHA,
      citationSetHash: CITATION_SET_HASH,
      citationValidationEvidenceHash: CITATION_VALIDATION_HASH,
      humanInstructionalDecisionBound: true,
      agentSynthesizedDecision: false,
      humanApproval: false,
    },
  };
}

describe('Phase 10H governance resolution contract', () => {
  test('resolves the six human-approved governance values exactly', () => {
    expect(contract.status).toBe(FINAL_CONTENT_APPROVAL_ACTIVE_STATUS);
    expect(contract.governance_constants).toEqual({
      FINAL_APPROVER_REQUIRED_ROLE: 'final_approver',
      FINAL_APPROVER_REQUIRED_SCOPE: 'native-question-final-approval',
      independencePolicy: {
        independentFromTechnicalReviewer: true,
        independentFromInstructionalReviewer: true,
      },
      checklistVersion: 'native-final-content-approval-v1',
      checklistCriteria: [
        'exact-payload-and-prior-evidence-binding',
        'technical-citation-and-instructional-gates-complete',
        'final-content-preserves-approved-scope-and-evidence',
        'no-unsupported-thresholds-procedures-or-claims',
        'no-assessment-scoring-delivery-or-release-authority',
        'blocked-claims-and-containment-preserved',
      ],
    });
    expect(contract.unresolved_governance_decisions).toEqual([]);
    expect(collectUnresolvedGovernanceDecisions(contract)).toEqual([]);
    expect(() => assertFinalContentApprovalActivationGate(contract)).not.toThrow();
  });

  test('activation gate still fails closed for sentinels or any unapproved status', () => {
    const unresolved = clone(contract);
    unresolved.governance_constants.FINAL_APPROVER_REQUIRED_ROLE = UNRESOLVED_GOVERNANCE_SENTINEL;
    expect(() => assertFinalContentApprovalActivationGate(unresolved)).toThrow(/unresolved governance decisions/);

    const wrongStatus = clone(contract);
    wrongStatus.status = 'draft-non-dispatchable';
    expect(() => assertFinalContentApprovalActivationGate(wrongStatus)).toThrow(/not activation-ready/);
  });

  test('contract binds the exact successful Phase 10G control point including review evidence hash', () => {
    expect(contract.control_commit).toBe('bd29fb7171ae81822ac2a1eb8ff3a8c6e5e802a8');
    expect(contract.referenced_10G_evidence).toMatchObject({
      governed_run_id: RUN_ID,
      checkpoint_version: 6,
      state: 'instructionally_reviewed',
      status: 'instructionally-reviewed',
      question_id: QUESTION_ID,
      provenance_id: PROVENANCE_ID,
      payload_sha256: PAYLOAD_SHA,
      citation_set_hash: CITATION_SET_HASH,
      citation_validation_evidence_hash: CITATION_VALIDATION_HASH,
      instructional_review_evidence_hash: INSTRUCTIONAL_REVIEW_HASH,
      human_approval: false,
    });
  });

  test('storage boundary allows only provenance final approval plus governed ledger write', () => {
    expect(contract.storage_boundary).toEqual({
      question_provenance_final_approval_write: true,
      public_scenario_questions_write: false,
      assessment_eligibility_write: false,
      orchestration_ledger_write_on_approval: true,
      citation_validation_write: false,
    });
    expect(contract.required_containment_after_10h).toMatchObject({
      public_scenario_question_rows: 0,
      assessment_eligibility_rows: 0,
      released_for_assessment: false,
      scored_delivery_authority: false,
      delivery_authority: false,
      release_authority: false,
      claims_02_and_12_blocked: true,
    });
  });
});

describe('Phase 10H approval evidence contract', () => {
  test('builds deterministic approval evidence from the approved role, scope, checklist and Phase 10G hash', () => {
    const first = buildEvidence();
    const second = buildEvidence();
    expect(first).toEqual(second);
    expect(first.evidenceHash).toBe(stableFinalContentApprovalEvidenceHash(first.evidence));
    expect(first.evidence).toMatchObject({
      approverRole: 'final_approver',
      approverScope: 'native-question-final-approval',
      instructionalReviewEvidenceHash: INSTRUCTIONAL_REVIEW_HASH,
      checklistVersion: 'native-final-content-approval-v1',
      checklistCompleted: true,
      allCriteriaPassed: true,
    });
    expect(first.evidence.checklistCriteria).toEqual(contract.governance_constants.checklistCriteria);
    expect(() => assertFinalContentApprovalEvidenceContract(first.evidence, contract)).not.toThrow();
  });

  test('rejects wrong role, scope, checklist, or Phase 10G evidence hash', () => {
    const valid = buildEvidence().evidence;
    expect(() => assertFinalContentApprovalEvidenceContract({ ...valid, approverRole: 'technical_reviewer' }, contract))
      .toThrow(/FINAL_APPROVER_REQUIRED_ROLE/);
    expect(() => assertFinalContentApprovalEvidenceContract({ ...valid, approverScope: 'native-question-instructional-review' }, contract))
      .toThrow(/FINAL_APPROVER_REQUIRED_SCOPE/);
    expect(() => assertFinalContentApprovalEvidenceContract({ ...valid, checklistCompleted: false }, contract))
      .toThrow(/checklist must be completed/);
    expect(() => assertFinalContentApprovalEvidenceContract({ ...valid, checklistCriteria: valid.checklistCriteria.slice(0, 5) }, contract))
      .toThrow(/complete approved checklist criteria/);
    expect(() => assertFinalContentApprovalEvidenceContract({ ...valid, instructionalReviewEvidenceHash: 'f'.repeat(64) }, contract))
      .not.toThrow();
    expect(() => assertInstructionalReviewEvidenceBinding({
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidence: { ...valid, instructionalReviewEvidenceHash: 'f'.repeat(64) },
      latestEntry: priorInstructionalEntry(),
    })).toThrow(/does not match the Phase 10G instructional review evidence/);
  });

  test('enforces both approved independence requirements', () => {
    expect(() => assertApprovedIndependencePolicy({
      independencePolicy: contract.governance_constants.independencePolicy,
      approverId: FINAL_APPROVER_ID,
      technicalReviewerId: TECHNICAL_REVIEWER_ID,
      instructionalReviewerId: INSTRUCTIONAL_REVIEWER_ID,
    })).not.toThrow();

    expect(() => assertApprovedIndependencePolicy({
      independencePolicy: contract.governance_constants.independencePolicy,
      approverId: TECHNICAL_REVIEWER_ID,
      technicalReviewerId: TECHNICAL_REVIEWER_ID,
      instructionalReviewerId: INSTRUCTIONAL_REVIEWER_ID,
    })).toThrow(/technical reviewer/);

    expect(() => assertApprovedIndependencePolicy({
      independencePolicy: contract.governance_constants.independencePolicy,
      approverId: INSTRUCTIONAL_REVIEWER_ID,
      technicalReviewerId: TECHNICAL_REVIEWER_ID,
      instructionalReviewerId: INSTRUCTIONAL_REVIEWER_ID,
    })).toThrow(/instructional reviewer/);
  });

  test('requires exact binding to the latest Phase 10G instructional review entry', () => {
    const evidence = buildEvidence().evidence;
    expect(() => assertInstructionalReviewEvidenceBinding({
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidence: evidence,
      latestEntry: priorInstructionalEntry(),
    })).not.toThrow();

    const drifted = priorInstructionalEntry();
    drifted.metadata.citationSetHash = 'f'.repeat(64);
    expect(() => assertInstructionalReviewEvidenceBinding({
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidence: evidence,
      latestEntry: drifted,
    })).toThrow(/not bound to the current instructional review/);
  });
});

describe('Phase 10H persistent runtime', () => {
  test('records exactly one human final-content transition with bound evidence metadata', async () => {
    const entries = [priorInstructionalEntry()];
    const appends = [];
    const reads = [];
    const runtime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator(entries, appends, reads),
    });
    const { evidence, evidenceHash } = buildEvidence();

    const recorded = await runtime.recordFinalContentApproval({
      runId: RUN_ID,
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: evidenceHash,
      approvalEvidence: evidence,
    });

    expect(appends).toHaveLength(1);
    expect(recorded).toMatchObject({
      actor: 'human',
      action: 'final-content-approval-recorded',
      state: 'final_content_approved',
      metadata: {
        provenanceId: PROVENANCE_ID,
        questionId: QUESTION_ID,
        approvalEvidenceHash: evidenceHash,
        approverIdentity: FINAL_APPROVER_ID,
        approverRole: 'final_approver',
        approverScope: 'native-question-final-approval',
        checklistVersion: 'native-final-content-approval-v1',
        payloadSha256: PAYLOAD_SHA,
        citationSetHash: CITATION_SET_HASH,
        citationValidationEvidenceHash: CITATION_VALIDATION_HASH,
        instructionalReviewEvidenceHash: INSTRUCTIONAL_REVIEW_HASH,
        humanFinalApprovalBound: true,
        agentSynthesizedDecision: false,
        humanApproval: true,
      },
    });
    expect(recorded.metadata.checklistCriteria).toEqual(contract.governance_constants.checklistCriteria);
    expect(reads.some((row) => row.method === 'loadEntries')).toBe(true);
    expect(reads.some((row) => row.method === 'recover')).toBe(true);
  });

  test('fails closed on stale prior state, evidence drift, non-human actor, and duplicate evidence drift', async () => {
    const { evidence, evidenceHash } = buildEvidence();

    const staleRuntime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator([], [], []),
    });
    await expect(staleRuntime.recordFinalContentApproval({
      runId: RUN_ID,
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: evidenceHash,
      approvalEvidence: evidence,
    })).rejects.toThrow(/instructionally_reviewed state/);

    const drifted = priorInstructionalEntry();
    drifted.metadata.reviewEvidenceHash = 'f'.repeat(64);
    const driftRuntime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator([drifted], [], []),
    });
    await expect(driftRuntime.recordFinalContentApproval({
      runId: RUN_ID,
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: evidenceHash,
      approvalEvidence: evidence,
    })).rejects.toThrow(/does not match the Phase 10G instructional review evidence/);

    const actorRuntime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator([priorInstructionalEntry()], [], []),
    });
    await expect(actorRuntime.recordFinalContentApproval({
      runId: RUN_ID,
      actor: 'question-agent',
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: evidenceHash,
      approvalEvidence: evidence,
    })).rejects.toThrow(/actor must be the human approver/);

    const existing = {
      action: 'final-content-approval-recorded',
      state: 'final_content_approved',
      metadata: {
        provenanceId: PROVENANCE_ID,
        questionId: QUESTION_ID,
        approvalEvidenceHash: 'f'.repeat(64),
      },
    };
    const duplicateRuntime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator([priorInstructionalEntry(), existing], [], []),
    });
    await expect(duplicateRuntime.recordFinalContentApproval({
      runId: RUN_ID,
      provenanceId: PROVENANCE_ID,
      questionId: QUESTION_ID,
      approvalEvidenceHash: evidenceHash,
      approvalEvidence: evidence,
    })).rejects.toThrow(/Existing final content approval evidence/);
  });

  test('post-write containment requires approved provenance and still forbids public or assessment promotion', () => {
    expect(() => assertFinalContentApprovalContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      reviewerId: FINAL_APPROVER_ID,
      provenance: {
        status: 'approved',
        approved_by: FINAL_APPROVER_ID,
        approved_at: '2026-10-08T02:15:00.000Z',
      },
    })).not.toThrow();
    expect(() => assertFinalContentApprovalContainment({
      scenarioQuestionCount: 1,
      assessmentEligibilityCount: 0,
      reviewerId: FINAL_APPROVER_ID,
      provenance: { status: 'approved', approved_by: FINAL_APPROVER_ID, approved_at: '2026-10-08T02:15:00.000Z' },
    })).toThrow(/public scenario_questions/);
  });
});

describe('Phase 10H production activation surfaces', () => {
  test('workflow is manually dispatchable only after governance resolution and binds production inputs explicitly', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('phase10h-governance-resolved-*');
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}');
    expect(workflow).toContain('FINAL_APPROVAL_REVIEWER_ID: ${{ inputs.reviewer_id }}');
    expect(workflow).toContain('FINAL_APPROVAL_DECISION: ${{ inputs.decision }}');
    expect(workflow).toContain('FINAL_APPROVAL_CHECKLIST_COMPLETED: ${{ inputs.checklist_completed }}');
    expect(workflow).not.toContain('comments:');
  });

  test('production script verifies Auth/profile authority, exact control point, recovery, and containment without promotion writes', () => {
    expect(scriptSource).toContain("require('@supabase/supabase-js')");
    expect(scriptSource).toContain(".from('profiles')");
    expect(scriptSource).toContain('client.auth.admin.getUserById(reviewerId)');
    expect(scriptSource).toContain('FINAL_APPROVER_REQUIRED_ROLE');
    expect(scriptSource).toContain('FINAL_APPROVER_REQUIRED_SCOPE');
    expect(scriptSource).toContain('approvalPersistedLedgerMissing');
    expect(scriptSource).toContain('prior final rejection exists for this exact payload');
    expect(scriptSource).toContain("status: 'approved'");
    expect(scriptSource).toContain('approved_by: reviewerId');
    expect(scriptSource).toContain('approved_at: reviewedAt');
    expect(scriptSource).toContain('recordFinalContentApproval');
    expect(scriptSource).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,300}\.(insert|update|upsert)\(/);
    expect(scriptSource).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,300}\.(insert|update|upsert)\(/);
    expect(scriptSource).not.toMatch(/\.from\('citation_validations'\)[\s\S]{0,300}\.(insert|update|upsert)\(/);
  });

  test('checkpoint recovery recognizes the dedicated final-content approval ledger action', () => {
    expect(coordinatorSource).toContain("'final-content-approval-recorded': 'final-content-approved'");
  });
});
