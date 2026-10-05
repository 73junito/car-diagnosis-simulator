const AIOrchestrator = require('../src/ai/runtime/ai-orchestrator');
const GovernanceRuntime = require('../src/ai/runtime/governance-runtime');
const HumanGateController = require('../src/ai/runtime/human-gate-controller');

describe('Phase 3 governed handoffs and human gates', () => {
  test('handoff is targeted to one governed agent and capability', async () => {
    const orchestrator = new AIOrchestrator();

    orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });
    orchestrator.registerAgent({
      id: 'validation-agent',
      capabilities: ['deterministic-validation'],
      execute: async () => ({ valid: true }),
    });

    orchestrator.submit({
      capability: 'question-drafting',
      governed: {
        runId: 'handoff-run',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });
    await orchestrator.drain();

    const handoff = orchestrator.recordHandoff({
      runId: 'handoff-run',
      fromAgentId: 'question-agent',
      toAgentId: 'validation-agent',
      capability: 'deterministic-validation',
      state: 'item_generated',
      handoffId: 'handoff-fixed-1',
    });

    expect(handoff.metadata.handoffId).toBe('handoff-fixed-1');

    expect(() =>
      orchestrator.submit({
        capability: 'deterministic-validation',
        governed: {
          runId: 'handoff-run',
          from: 'item_generated',
          to: 'exact_payload_validated',
          handoffId: 'wrong-handoff',
        },
      })
    ).toThrow(/does not authorize/);

    orchestrator.submit({
      capability: 'deterministic-validation',
      governed: {
        runId: 'handoff-run',
        from: 'item_generated',
        to: 'exact_payload_validated',
        handoffId: 'handoff-fixed-1',
      },
    });

    await orchestrator.drain();

    expect(orchestrator.getRunLedger('handoff-run').at(-1).state)
      .toBe('exact_payload_validated');
  });

  test('human approval uses a separate control plane and advances the shared run', async () => {
    const governanceRuntime = new GovernanceRuntime();
    const humanGate = new HumanGateController({ governanceRuntime });
    const orchestrator = new AIOrchestrator({ governanceRuntime });

    expect(orchestrator.governanceRuntime).toBeUndefined();

    const approval = humanGate.recordApproval({
      runId: 'human-run',
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      reviewerIdentity: 'human-reviewer',
      reviewedAt: '2026-10-05T03:00:00Z',
      approvalEvidence: 'approval-record-001',
    });

    expect(approval.action).toBe('human-approval-recorded');
    expect(approval.state).toBe('final_content_approved');

    orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });

    orchestrator.submit({
      capability: 'question-drafting',
      governed: {
        runId: 'human-run',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });

    await orchestrator.drain();

    expect(orchestrator.getRunLedger('human-run').at(-1).state)
      .toBe('item_generated');
  });

  test('human approval requires evidence and cannot skip the state machine', () => {
    const governanceRuntime = new GovernanceRuntime();
    const humanGate = new HumanGateController({ governanceRuntime });

    expect(() =>
      humanGate.recordApproval({
        runId: 'missing-evidence',
        from: 'instructionally_reviewed',
        to: 'final_content_approved',
        reviewerIdentity: 'human-reviewer',
        reviewedAt: '2026-10-05T03:00:00Z',
      })
    ).toThrow(/approvalEvidence/);

    expect(() =>
      humanGate.recordApproval({
        runId: 'skip-run',
        from: 'instructionally_reviewed',
        to: 'scored_delivery_enabled',
        reviewerIdentity: 'human-reviewer',
        reviewedAt: '2026-10-05T03:00:00Z',
        approvalEvidence: 'approval-record-002',
      })
    ).toThrow(/Human transition denied/);
  });

  test('positive production API eligibility still requires runtime verification', () => {
    const governanceRuntime = new GovernanceRuntime();
    const humanGate = new HumanGateController({ governanceRuntime });

    expect(() =>
      humanGate.recordApproval({
        runId: 'api-run',
        from: 'production_api_review_prepared',
        to: 'production_api_eligible',
        reviewerIdentity: 'human-reviewer',
        reviewedAt: '2026-10-05T03:00:00Z',
        approvalEvidence: 'approval-record-003',
        runtimeVerified: false,
      })
    ).toThrow(/Runtime verification is required/);

    const approval = humanGate.recordApproval({
      runId: 'api-run-approved',
      from: 'production_api_review_prepared',
      to: 'production_api_eligible',
      reviewerIdentity: 'human-reviewer',
      reviewedAt: '2026-10-05T03:00:00Z',
      approvalEvidence: 'approval-record-004',
      runtimeVerified: true,
    });

    expect(approval.state).toBe('production_api_eligible');
    expect(approval.metadata.runtimeVerified).toBe(true);
  });
});
