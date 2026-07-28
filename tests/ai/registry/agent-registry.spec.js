const AgentRegistry = require('../../../src/ai/registry/agent-registry');

describe('AgentRegistry', () => {
  function makeAgent({
    id = 'diagnostics-agent',
    capabilities = ['diagnostics'],
    defaultPriority = 1,
  } = {}) {
    return {
      id,
      name: id,
      capabilities,
      defaultPriority,
      execute: jest.fn(async () => ({ done: true })),
    };
  }

  test('registers and retrieves an agent', () => {
    const registry = new AgentRegistry();
    const agent = makeAgent();

    registry.register(agent);

    expect(registry.has(agent.id)).toBe(true);
    expect(registry.get(agent.id).id).toBe(agent.id);
  });

  test('rejects duplicate agent ids', () => {
    const registry = new AgentRegistry();
    const agent = makeAgent();

    registry.register(agent);

    expect(() => registry.register(agent)).toThrow(/already registered/);
  });

  test('resolves the highest-priority matching agent', () => {
    const registry = new AgentRegistry();

    registry.register(
      makeAgent({
        id: 'low',
        defaultPriority: 1,
      })
    );

    registry.register(
      makeAgent({
        id: 'high',
        defaultPriority: 10,
      })
    );

    expect(registry.resolve('diagnostics').id).toBe('high');
  });

  test('resolves a specifically requested agent', () => {
    const registry = new AgentRegistry();

    registry.register(
      makeAgent({
        id: 'first',
      })
    );

    registry.register(
      makeAgent({
        id: 'second',
      })
    );

    expect(
      registry.resolve('diagnostics', {
        agentId: 'second',
      }).id
    ).toBe('second');
  });

  test('unregisters capability ownership', () => {
    const registry = new AgentRegistry();
    const agent = makeAgent();

    registry.register(agent);
    expect(registry.findByCapability('diagnostics')).toHaveLength(1);

    registry.unregister(agent.id);

    expect(registry.findByCapability('diagnostics')).toHaveLength(0);
  });
});
