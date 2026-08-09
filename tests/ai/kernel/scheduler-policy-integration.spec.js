const AgentProcess = require(
  '../../../src/ai/kernel/agent-process'
);
const SchedulerKernel = require(
  '../../../src/ai/kernel/scheduler-kernel'
);
const PolicyEngine = require(
  '../../../src/ai/governance/policy-engine'
);

describe('SchedulerKernel policy integration', () => {
  test('executes a process when policy evaluation allows it', async () => {
    const task = jest.fn(async () => ({
      done: true,
      value: 'completed',
    }));

    const policyEngine = new PolicyEngine();

    policyEngine.register({
      id: 'allow-diagnostics',
      evaluate: ({ capability }) =>
        capability === 'diagnostics',
    });

    const scheduler = new SchedulerKernel({
      policyEngine,
    });

    const process = new AgentProcess({
      id: 'diagnostic-process-1',
      agentId: 'diagnostic-agent',
      capability: 'diagnostics',
      task,
    });

    scheduler.enqueue(process);
    await scheduler.drain();

    expect(task).toHaveBeenCalledTimes(1);
    expect(process.status).toBe('completed');
    expect(scheduler.getStats()).toMatchObject({
      completed: 1,
      failed: 0,
      paused: 0,
    });
  });

  test('pauses a process when policy evaluation denies it', async () => {
    const task = jest.fn(async () => ({
      done: true,
    }));

    const eventBus = {
      publish: jest.fn(),
    };

    const policyEngine = new PolicyEngine({
      eventBus,
    });

    policyEngine.register({
      id: 'deny-browser',
      evaluate: ({ capability }) => ({
        allowed: capability !== 'browser',
        reason: 'Browser capability is disabled',
      }),
    });

    const scheduler = new SchedulerKernel({
      eventBus,
      policyEngine,
    });

    const process = new AgentProcess({
      id: 'browser-process-1',
      agentId: 'browser-agent',
      capability: 'browser',
      task,
    });

    scheduler.enqueue(process);
    await scheduler.drain();

    expect(task).not.toHaveBeenCalled();
    expect(process.status).toBe('paused');

    expect(process.metadata.policyDecision).toMatchObject({
      allowed: false,
      deniedBy: 'deny-browser',
      reason: 'Browser capability is disabled',
    });

    expect(scheduler.getStats()).toMatchObject({
      completed: 0,
      failed: 0,
      paused: 1,
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'process.denied',
      expect.objectContaining({
        decision: expect.objectContaining({
          allowed: false,
          deniedBy: 'deny-browser',
        }),
      })
    );
  });

  test('can resume a denied process after policy conditions change', async () => {
    let executionAllowed = false;

    const task = jest.fn(async () => ({
      done: true,
      value: 'completed-after-resume',
    }));

    const policyEngine = new PolicyEngine();

    policyEngine.register({
      id: 'runtime-switch',
      evaluate: () => ({
        allowed: executionAllowed,
        reason: executionAllowed
          ? null
          : 'Runtime execution is temporarily disabled',
      }),
    });

    const scheduler = new SchedulerKernel({
      policyEngine,
    });

    const process = new AgentProcess({
      id: 'resumable-process-1',
      capability: 'diagnostics',
      task,
    });

    scheduler.enqueue(process);
    await scheduler.drain();

    expect(process.status).toBe('paused');
    expect(task).not.toHaveBeenCalled();

    executionAllowed = true;

    const resumed = scheduler.resume(process.id);

    expect(resumed).toBe(process);
    expect(process.status).toBe('ready');

    await scheduler.drain();

    expect(task).toHaveBeenCalledTimes(1);
    expect(process.status).toBe('completed');

    expect(scheduler.getStats()).toMatchObject({
      completed: 1,
      failed: 0,
      paused: 0,
    });
  });

  test('preserves existing behavior when no policy engine is configured', async () => {
    const task = jest.fn(async () => ({
      done: true,
    }));

    const scheduler = new SchedulerKernel();

    const process = new AgentProcess({
      id: 'legacy-process-1',
      task,
    });

    scheduler.enqueue(process);
    await scheduler.drain();

    expect(task).toHaveBeenCalledTimes(1);
    expect(process.status).toBe('completed');
  });

  test('rejects an invalid policy engine', () => {
    expect(
      () =>
        new SchedulerKernel({
          policyEngine: {},
        })
    ).toThrow('policyEngine must provide an evaluate function');
  });
});
