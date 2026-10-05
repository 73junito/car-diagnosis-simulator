const AIOrchestrator = require('../src/ai/runtime/ai-orchestrator');

describe('AIOrchestrator governed runtime integration', () => {
  test('legacy submissions remain backward compatible', async () => {
    const orchestrator = new AIOrchestrator();
    orchestrator.registerAgent({
      id: 'legacy-agent',
      capabilities: ['legacy-work'],
      execute: async () => ({ done: true }),
    });

    orchestrator.submit({
      id: 'legacy-1',
      capability: 'legacy-work',
    });

    await orchestrator.drain();

    expect(orchestrator.getRequest('legacy-1').process.status).toBe('completed');
    expect(orchestrator.getRunLedger('missing-run')).toEqual([]);
  });

  test('governed submissions enforce transition and write ledger entries', async () => {
    const orchestrator = new AIOrchestrator();
    orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ itemId: 'item-1' }),
    });

    orchestrator.submit({
      id: 'governed-1',
      capability: 'question-drafting',
      governed: {
        runId: 'run-1',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });

    expect(orchestrator.getRunLedger('run-1')).toHaveLength(1);
    expect(orchestrator.getRunLedger('run-1')[0].state).toBe('final_content_approved');

    await orchestrator.drain();

    const ledger = orchestrator.getRunLedger('run-1');
    expect(ledger).toHaveLength(2);
    expect(ledger[1].state).toBe('item_generated');
    expect(ledger[1].action).toBe('step-finished');
  });

  test('governed submissions reject skipped workflow states', () => {
    const orchestrator = new AIOrchestrator();
    orchestrator.registerAgent({
      id: 'question-agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });

    expect(() =>
      orchestrator.submit({
        capability: 'question-drafting',
        governed: {
          runId: 'run-skip',
          from: 'drafted',
          to: 'item_generated',
        },
      })
    ).toThrow(/Governed transition denied/);
  });

  test('agent execution cannot cross a human-only transition', () => {
    const orchestrator = new AIOrchestrator();
    orchestrator.registerAgent({
      id: 'instructional-review-agent',
      capabilities: ['instructional-review-preparation'],
      execute: async () => ({ done: true }),
    });

    expect(() =>
      orchestrator.submit({
        capability: 'instructional-review-preparation',
        governed: {
          runId: 'run-human-gate',
          from: 'instructionally_reviewed',
          to: 'final_content_approved',
        },
      })
    ).toThrow(/Governed transition denied/);
  });

  test('governed handoffs require run continuity', async () => {
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
        runId: 'run-continuity',
        from: 'final_content_approved',
        to: 'item_generated',
      },
    });
    await orchestrator.drain();

    expect(() =>
      orchestrator.submit({
        capability: 'deterministic-validation',
        governed: {
          runId: 'run-continuity',
          from: 'final_content_approved',
          to: 'exact_payload_validated',
        },
      })
    ).toThrow(/latest ledger state/);

    expect(() =>
      orchestrator.submit({
        capability: 'deterministic-validation',
        governed: {
          runId: 'run-continuity',
          from: 'item_generated',
          to: 'exact_payload_validated',
        },
      })
    ).toThrow(/handoff is required/);

    const handoff = orchestrator.recordHandoff({
      runId: 'run-continuity',
      fromAgentId: 'question-agent',
      toAgentId: 'validation-agent',
      capability: 'deterministic-validation',
      state: 'item_generated',
    });

    orchestrator.submit({
      capability: 'deterministic-validation',
      governed: {
        runId: 'run-continuity',
        from: 'item_generated',
        to: 'exact_payload_validated',
        handoffId: handoff.metadata.handoffId,
      },
    });
    await orchestrator.drain();

    expect(orchestrator.getRunLedger('run-continuity').at(-1).state)
      .toBe('exact_payload_validated');
  });
});
