'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PersistentGovernanceRuntime = require('../src/ai/runtime/persistent-governance-runtime');
const {
  UNRESOLVED_GOVERNANCE_SENTINEL,
  collectUnresolvedGovernanceDecisions,
  assertGovernanceConstantsResolved,
  assertFinalContentApprovalScaffoldGate,
  assertApprovedIndependencePolicy,
} = require('../src/ai/runtime/native-final-content-approval');

const contractPath = path.join(__dirname, '..', 'data', 'architecture', 'agent-orchestration-native-final-content-approval.json');
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'record-native-question-final-approval.yml');
const scriptPath = path.join(__dirname, '..', 'scripts', 'record-native-question-final-approval.js');

const EXPECTED_UNRESOLVED = [
  'FINAL_APPROVER_REQUIRED_ROLE',
  'FINAL_APPROVER_REQUIRED_SCOPE',
  'independencePolicy.independentFromTechnicalReviewer',
  'independencePolicy.independentFromInstructionalReviewer',
  'checklistVersion',
  'checklistCriteria',
];

function resolvedContractOverride(independenceRequired = true) {
  return {
    ...JSON.parse(fs.readFileSync(contractPath, 'utf8')),
    governance_constants: {
      FINAL_APPROVER_REQUIRED_ROLE: 'content_approver',
      FINAL_APPROVER_REQUIRED_SCOPE: 'native-question-final-approval',
      independencePolicy: {
        independentFromTechnicalReviewer: independenceRequired,
        independentFromInstructionalReviewer: independenceRequired,
      },
      checklistVersion: 'native-final-content-approval-v1',
      checklistCriteria: ['human-final-approval-checklist-criterion'],
    },
  };
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
    recover: async () => {
      reads.push({ method: 'recover', args: [] });
      return null;
    },
  };
}

function buildApprovalEvidence(overrides = {}) {
  return {
    provenanceId: 'c3b07430-db49-4216-9878-c3efb4ab0a54',
    questionId: 'charging-system-ai-draft-e9ac4b22b122',
    payloadSha256: '1b833a88a6fc8a0a79feaaa3f8848ac4b8cb3573f158effa0a6593bebf7cf10e',
    citationSetHash: '47bf8234e313be166026771ccf5cd6ab59b62f917422a51ce347eeaa6bb88a32',
    citationValidationEvidenceHash: '01a5a2a2f34fc47ca16417f8bfca43ff659aacaf8f0fa1b5dc930a3269617a3c',
    reviewerId: '2f14c3d5-6f9b-4f69-8f9f-3f6a9a1b2c3d',
    technicalReviewerId: '5a9e0d2c-1b3f-4c7e-9a1d-7e2b4c6f8a01',
    instructionalReviewerId: '9c3b7e1f-2a4d-4b8c-8e6a-1f5d9c7b3a22',
    reviewedAt: '2026-10-07T23:59:00Z',
    decision: 'approve',
    checklistVersion: 'native-final-content-approval-v1',
    checklistCompleted: true,
    submittedBy: 'phase10h-test',
    ...overrides,
  };
}

function hashEvidence(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

describe('Phase 10H native final content approval contract', () => {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

  test('contract stays draft-non-dispatchable with unresolved governance decisions', () => {
    expect(contract.phase).toBe('10H');
    expect(contract.status).toBe('draft-non-dispatchable');
    expect(contract.state_transition).toEqual({
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      actor: 'human',
      requires_explicit_human_approval: true,
    });
    expect(contract.governance_constants.FINAL_APPROVER_REQUIRED_ROLE).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.governance_constants.FINAL_APPROVER_REQUIRED_SCOPE).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.governance_constants.independencePolicy.independentFromTechnicalReviewer).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.governance_constants.independencePolicy.independentFromInstructionalReviewer).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.governance_constants.checklistVersion).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.governance_constants.checklistCriteria).toBe(UNRESOLVED_GOVERNANCE_SENTINEL);
    expect(contract.unresolved_governance_decisions).toEqual(EXPECTED_UNRESOLVED);
    expect(collectUnresolvedGovernanceDecisions(contract)).toEqual(EXPECTED_UNRESOLVED);
    expect(() => assertGovernanceConstantsResolved(contract)).toThrow(/unresolved governance decisions/);
  });

  test('scaffold gate rejects the unresolved repository contract first and a resolved draft contract by status', () => {
    const repositoryContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    expect(() => assertFinalContentApprovalScaffoldGate(repositoryContract)).toThrow(
      /unresolved governance decisions/
    );
    expect(() => assertFinalContentApprovalScaffoldGate(resolvedContractOverride())).toThrow(
      /draft-non-dispatchable/
    );
  });

  test('independence policy accepts either approved boolean and the approved value is enforced', () => {
    const notRequired = resolvedContractOverride(false);
    expect(collectUnresolvedGovernanceDecisions(notRequired)).toEqual([]);
    expect(() => assertGovernanceConstantsResolved(notRequired)).not.toThrow();

    const sharedApprover = '2f14c3d5-6f9b-4f69-8f9f-3f6a9a1b2c3d';
    expect(() =>
      assertApprovedIndependencePolicy({
        independencePolicy: notRequired.governance_constants.independencePolicy,
        approverId: sharedApprover,
        technicalReviewerId: sharedApprover,
        instructionalReviewerId: sharedApprover,
      })
    ).not.toThrow();

    expect(() =>
      assertApprovedIndependencePolicy({
        independencePolicy: resolvedContractOverride(true).governance_constants.independencePolicy,
        approverId: sharedApprover,
        technicalReviewerId: sharedApprover,
        instructionalReviewerId: '5a9e0d2c-1b3f-4c7e-9a1d-7e2b4c6f8a01',
      })
    ).toThrow(/independent from the technical reviewer/);

    expect(() =>
      assertApprovedIndependencePolicy({
        independencePolicy: {
          independentFromTechnicalReviewer: 'UNRESOLVED_GOVERNANCE_DECISION',
          independentFromInstructionalReviewer: true,
        },
        approverId: 'approver',
        technicalReviewerId: 'technical',
        instructionalReviewerId: 'instructional',
      })
    ).toThrow(/approved boolean/);
  });

  test('contract binds the exact 10G instructional review evidence', () => {
    const evidence = contract.referenced_10G_evidence;
    expect(evidence.governed_run_id).toBe('native-draft:37418457881:charging-system');
    expect(evidence.github_actions_run_id).toBe(37703982461);
    expect(evidence.state).toBe('instructionally_reviewed');
    expect(evidence.checkpoint_version).toBe(6);
    expect(evidence.status).toBe('instructionally-reviewed');
    expect(evidence.question_id).toBe('charging-system-ai-draft-e9ac4b22b122');
    expect(evidence.provenance_id).toBe('c3b07430-db49-4216-9878-c3efb4ab0a54');
    expect(evidence.payload_sha256).toBe('1b833a88a6fc8a0a79feaaa3f8848ac4b8cb3573f158effa0a6593bebf7cf10e');
    expect(evidence.citation_set_hash).toBe('47bf8234e313be166026771ccf5cd6ab59b62f917422a51ce347eeaa6bb88a32');
    expect(evidence.citation_validation_evidence_hash).toBe('01a5a2a2f34fc47ca16417f8bfca43ff659aacaf8f0fa1b5dc930a3269617a3c');
    expect(evidence.human_decision).toBe('pass');
    expect(evidence.human_approval).toBe(false);
    expect(evidence.agent_synthesized_decision).toBe(false);
  });

  test('contract requires containment after a future 10H transition that has not occurred', () => {
    expect(contract.required_containment_after_future_10h).toEqual({
      public_scenario_question_rows: 0,
      assessment_eligibility_rows: 0,
      released_for_assessment: false,
      scored_delivery_authority: false,
      delivery_authority: false,
      release_authority: false,
      claims_02_and_12_blocked: true,
    });
    expect(Object.values(contract.storage_boundary)).toEqual([false, false, false, false, false]);
    expect(contract.invariants.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Phase 10H runtime final content approval control plane', () => {
  test('runtime fails closed on unresolved governance decisions before any ledger write', async () => {
    const appends = [];
    const runtime = new PersistentGovernanceRuntime({ coordinator: createStubCoordinator([], appends) });
    const evidence = buildApprovalEvidence();
    const evidenceHash = hashEvidence(evidence);

    await expect(
      runtime.recordFinalContentApproval({
        runId: 'native-draft:37418457881:charging-system',
        provenanceId: evidence.provenanceId,
        questionId: evidence.questionId,
        approvalEvidenceHash: evidenceHash,
        approvalEvidence: evidence,
      })
    ).rejects.toThrow(/unresolved governance decisions/);

    expect(appends).toHaveLength(0);
  });

  test('runtime rejects a fully valid instructionally_reviewed ledger state before reading or appending', async () => {
    const appends = [];
    const reads = [];
    const evidence = buildApprovalEvidence();
    const evidenceHash = hashEvidence(evidence);
    const reviewEvidenceHash = crypto
      .createHash('sha256')
      .update('phase10g-instructional-review-evidence')
      .digest('hex');
    // Fully valid prior state: the latest ledger entry is the Phase 10G
    // instructional review bound to the exact approval evidence below.
    const priorEntry = {
      runId: 'native-draft:37418457881:charging-system',
      actor: 'human',
      action: 'instructional-review-recorded',
      state: 'instructionally_reviewed',
      metadata: {
        provenanceId: evidence.provenanceId,
        questionId: evidence.questionId,
        reviewEvidenceHash,
        reviewerIdentity: evidence.instructionalReviewerId,
        technicalReviewerIdentity: evidence.technicalReviewerId,
        reviewedAt: evidence.reviewedAt,
        payloadSha256: evidence.payloadSha256,
        citationSetHash: evidence.citationSetHash,
        citationValidationEvidenceHash: evidence.citationValidationEvidenceHash,
        humanInstructionalDecisionBound: true,
        agentSynthesizedDecision: false,
        humanApproval: false,
      },
    };
    const runtime = new PersistentGovernanceRuntime({
      coordinator: createStubCoordinator([priorEntry], appends, reads),
    });

    await expect(
      runtime.recordFinalContentApproval({
        runId: 'native-draft:37418457881:charging-system',
        provenanceId: evidence.provenanceId,
        questionId: evidence.questionId,
        approvalEvidenceHash: evidenceHash,
        approvalEvidence: evidence,
      })
    ).rejects.toThrow(/unresolved governance decisions/);

    expect(reads).toHaveLength(0);
    expect(appends).toHaveLength(0);
  });
});

describe('Phase 10H workflow and script fail closed', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const scriptSource = fs.readFileSync(scriptPath, 'utf8');

  test('workflow never grants production access and every job step exits 1', () => {
    // No manual dispatch entry may exist during the design phase; the only
    // trigger is the governance-resolution tag gate, and steps still fail closed.
    expect(workflow).not.toMatch(/^\s*workflow_dispatch:/m);
    expect(workflow).toContain('phase10h-governance-resolved-*');
    expect(workflow).not.toContain('environment:');
    expect(workflow).not.toContain('SERVICE_ROLE_KEY');
    expect(workflow).not.toContain('SUPABASE_URL');
    const exitCount = (workflow.match(/exit 1/g) || []).length;
    expect(exitCount).toBeGreaterThanOrEqual(2);
  });

  test('script fails closed on unresolved governance decisions without importing Supabase', () => {
    expect(scriptSource).not.toContain('@supabase/supabase-js');
    expect(scriptSource).not.toContain('createClient');
    expect(scriptSource).not.toContain('question_provenance');

    const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.failClosed).toBe(true);
    expect(output.reason).toBe('unresolved-governance-decisions');
    expect(output.productionWritePerformed).toBe(false);
    expect(output.unresolved).toEqual(EXPECTED_UNRESOLVED);
  });

  test('script still fails closed with a complete human attestation while governance is unresolved', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FINAL_APPROVAL_DECISION: 'approve',
        FINAL_APPROVAL_REVIEWER_ID: '2f14c3d5-6f9b-4f69-8f9f-3f6a9a1b2c3d',
        FINAL_APPROVAL_REVIEWED_AT: '2026-10-07T23:59:00Z',
        FINAL_APPROVAL_CHECKLIST_COMPLETED: 'true',
        FINAL_APPROVAL_EVIDENCE: 'final-approval-evidence-ref',
        FINAL_APPROVAL_SUBMITTED_BY: 'phase10h-test',
      },
    });
    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.failClosed).toBe(true);
    expect(output.reason).toBe('unresolved-governance-decisions');
    expect(output.unresolved).toEqual(EXPECTED_UNRESOLVED);
    expect(output.productionWritePerformed).toBe(false);
    // Defense in depth: even if governance were resolved, the Phase 10H
    // non-production containment branch keeps the write path closed.
    expect(scriptSource).toContain('phase-10h-non-production-write-path-disabled');
  });
});