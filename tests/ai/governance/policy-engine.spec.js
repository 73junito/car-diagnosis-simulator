const PolicyEngine = require(
  '../../../src/ai/governance/policy-engine'
);

describe('PolicyEngine', () => {
  test('allows execution when no policies exist and default is allow', async () => {
    const engine = new PolicyEngine();

    const decision = await engine.evaluate({
      processId: 'process-1',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.deniedBy).toBeNull();
    expect(decision.evaluations).toEqual([]);
  });

  test('denies execution when no policies exist and default is deny', async () => {
    const engine = new PolicyEngine({
      defaultDecision: 'deny',
    });

    const decision = await engine.evaluate();

    expect(decision.allowed).toBe(false);
    expect(decision.deniedBy).toBe('default');
  });

  test('registers and lists policies by priority', () => {
    const engine = new PolicyEngine();

    engine.register({
      id: 'low-priority',
      priority: 1,
      evaluate: () => true,
    });

    engine.register({
      id: 'high-priority',
      priority: 10,
      evaluate: () => true,
    });

    expect(engine.list().map((policy) => policy.id)).toEqual([
      'high-priority',
      'low-priority',
    ]);
  });

  test('allows execution when all policies allow', async () => {
    const engine = new PolicyEngine();

    engine.register({
      id: 'role-policy',
      evaluate: ({ role }) => role === 'instructor',
    });

    engine.register({
      id: 'quota-policy',
      evaluate: ({ quota }) => ({
        allowed: quota > 0,
        reason: quota > 0 ? null : 'Quota exhausted',
      }),
    });

    const decision = await engine.evaluate({
      role: 'instructor',
      quota: 5,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.evaluations).toHaveLength(2);
  });

  test('stops evaluation when a policy denies execution', async () => {
    const engine = new PolicyEngine();

    engine.register({
      id: 'deny-browser',
      priority: 10,
      evaluate: ({ capability }) => ({
        allowed: capability !== 'browser',
        reason: 'Browser access is disabled',
      }),
    });

    engine.register({
      id: 'never-reached',
      priority: 1,
      evaluate: jest.fn(() => true),
    });

    const decision = await engine.evaluate({
      capability: 'browser',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.deniedBy).toBe('deny-browser');
    expect(decision.reason).toBe('Browser access is disabled');
    expect(decision.evaluations).toHaveLength(1);
  });

  test('supports asynchronous policies', async () => {
    const engine = new PolicyEngine();

    engine.register({
      id: 'async-policy',
      evaluate: async () => {
        await Promise.resolve();
        return true;
      },
    });

    const decision = await engine.evaluate();

    expect(decision.allowed).toBe(true);
  });

  test('fails closed when a policy throws', async () => {
    const engine = new PolicyEngine();

    engine.register({
      id: 'broken-policy',
      evaluate: () => {
        throw new Error('Policy unavailable');
      },
    });

    const decision = await engine.evaluate();

    expect(decision.allowed).toBe(false);
    expect(decision.deniedBy).toBe('broken-policy');
    expect(decision.reason).toContain('Policy unavailable');
  });

  test('can disable and re-enable a policy', async () => {
    const engine = new PolicyEngine({
      defaultDecision: 'allow',
    });

    engine.register({
      id: 'deny-all',
      evaluate: () => false,
    });

    engine.disable('deny-all');

    let decision = await engine.evaluate();
    expect(decision.allowed).toBe(true);

    engine.enable('deny-all');

    decision = await engine.evaluate();
    expect(decision.allowed).toBe(false);
  });

  test('publishes policy lifecycle events', async () => {
    const eventBus = {
      publish: jest.fn(),
    };

    const engine = new PolicyEngine({ eventBus });

    engine.register({
      id: 'allow-all',
      evaluate: () => true,
    });

    await engine.evaluate({
      processId: 'process-1',
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'policy.registered',
      expect.any(Object)
    );

    expect(eventBus.publish).toHaveBeenCalledWith(
      'policy.allowed',
      expect.any(Object)
    );
  });

  test('rejects duplicate policy identifiers', () => {
    const engine = new PolicyEngine();

    const policy = {
      id: 'duplicate',
      evaluate: () => true,
    };

    engine.register(policy);

    expect(() => engine.register(policy)).toThrow(
      'Policy duplicate is already registered'
    );
  });
});
