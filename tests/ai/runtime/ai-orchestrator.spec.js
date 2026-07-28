const AIOrchestrator = require('../../../src/ai/runtime/ai-orchestrator');

describe('AIOrchestrator', () => {
  test('routes a request to an agent by capability', async () => {
    const execute = jest.fn(async ({ input }) => ({
      done: true,
      diagnosis: input.symptom,
    }));

    const orchestrator = new AIOrchestrator();

    orchestrator.registerAgent({
      id: 'diagnostics-agent',
      name: 'Diagnostics Agent',
      capabilities: ['diagnostics'],
      defaultPriority: 5,
      execute,
    });

    const submitted = orchestrator.submit({
      id: 'request-1',
      capability: 'diagnostics',
      input: {
        symptom: 'no crank',
      },
    });

    expect(submitted.status).toBe('ready');
    expect(submitted.agentId).toBe('diagnostics-agent');

    await orchestrator.drain();

    const completed = orchestrator.getRequest('request-1');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(completed.process.status).toBe('completed');
    expect(completed.process.result.diagnosis).toBe('no crank');
  });

  test('publishes lifecycle events', async () => {
    const orchestrator = new AIOrchestrator();
    const events = [];

    orchestrator.eventBus.subscribe('*', (event) => {
      events.push(event.type);
    });

    orchestrator.registerAgent({
      id: 'assessment-agent',
      capabilities: ['assessment'],
      execute: async () => ({
        done: true,
        score: 90,
      }),
    });

    orchestrator.submit({
      id: 'request-2',
      capability: 'assessment',
    });

    await orchestrator.drain();

    expect(events).toEqual(
      expect.arrayContaining([
        'agent.registered',
        'process.enqueued',
        'request.submitted',
        'process.started',
        'process.completed',
      ])
    );
  });

  test('uses priority scheduling across submitted requests', async () => {
    const order = [];
    const orchestrator = new AIOrchestrator({
      maxConcurrent: 1,
    });

    orchestrator.registerAgent({
      id: 'worker',
      capabilities: ['work'],
      execute: async ({ input }) => {
        order.push(input.id);

        return {
          done: true,
        };
      },
    });

    orchestrator.submit({
      id: 'low',
      capability: 'work',
      priority: 1,
      input: {
        id: 'low',
      },
    });

    orchestrator.submit({
      id: 'high',
      capability: 'work',
      priority: 10,
      input: {
        id: 'high',
      },
    });

    await orchestrator.drain();

    expect(order).toEqual(['high', 'low']);
  });

  test('rejects a capability with no registered agent', () => {
    const orchestrator = new AIOrchestrator();

    expect(() =>
      orchestrator.submit({
        capability: 'missing',
      })
    ).toThrow(/No agent provides capability/);
  });
});
