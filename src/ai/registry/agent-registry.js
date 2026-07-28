/**
 * Registry of product-facing AI agents and their capabilities.
 */
class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.capabilities = new Map();
  }

  register(agent) {
    this.validateAgent(agent);

    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }

    const normalized = Object.freeze({
      ...agent,
      capabilities: Object.freeze([...agent.capabilities]),
    });

    this.agents.set(normalized.id, normalized);

    for (const capability of normalized.capabilities) {
      if (!this.capabilities.has(capability)) {
        this.capabilities.set(capability, new Set());
      }

      this.capabilities.get(capability).add(normalized.id);
    }

    return normalized;
  }

  unregister(agentId) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return false;
    }

    this.agents.delete(agentId);

    for (const capability of agent.capabilities) {
      const agentIds = this.capabilities.get(capability);

      if (!agentIds) {
        continue;
      }

      agentIds.delete(agentId);

      if (agentIds.size === 0) {
        this.capabilities.delete(capability);
      }
    }

    return true;
  }

  get(agentId) {
    return this.agents.get(agentId) || null;
  }

  has(agentId) {
    return this.agents.has(agentId);
  }

  list() {
    return Array.from(this.agents.values());
  }

  findByCapability(capability) {
    const agentIds = this.capabilities.get(capability);

    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map((agentId) => this.agents.get(agentId))
      .filter(Boolean)
      .sort((a, b) => {
        const priorityDelta =
          Number(b.defaultPriority || 0) - Number(a.defaultPriority || 0);

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return a.id.localeCompare(b.id);
      });
  }

  resolve(capability, { agentId = null } = {}) {
    if (agentId) {
      const agent = this.get(agentId);

      if (!agent) {
        throw new Error(`Agent ${agentId} is not registered`);
      }

      if (!agent.capabilities.includes(capability)) {
        throw new Error(
          `Agent ${agentId} does not provide capability ${capability}`
        );
      }

      return agent;
    }

    const candidates = this.findByCapability(capability);

    if (candidates.length === 0) {
      throw new Error(`No agent provides capability ${capability}`);
    }

    return candidates[0];
  }

  validateAgent(agent) {
    if (!agent || typeof agent !== 'object') {
      throw new Error('Agent definition must be an object');
    }

    if (!agent.id || typeof agent.id !== 'string') {
      throw new Error('Agent definition requires a non-empty string id');
    }

    if (!Array.isArray(agent.capabilities) || agent.capabilities.length === 0) {
      throw new Error(
        `Agent ${agent.id} requires at least one capability`
      );
    }

    if (
      agent.capabilities.some(
        (capability) => !capability || typeof capability !== 'string'
      )
    ) {
      throw new Error(
        `Agent ${agent.id} contains an invalid capability`
      );
    }

    if (typeof agent.execute !== 'function') {
      throw new Error(`Agent ${agent.id} requires an execute function`);
    }
  }
}

module.exports = AgentRegistry;
