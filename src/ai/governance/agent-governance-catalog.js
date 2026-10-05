'use strict';

class AgentGovernanceCatalog {
  constructor(definition) {
    if (!definition || !Array.isArray(definition.agents)) {
      throw new Error('AgentGovernanceCatalog requires agent definitions');
    }
    this.agents = new Map(definition.agents.map((agent) => [agent.id, Object.freeze({ ...agent })]));
  }

  get(agentId) {
    return this.agents.get(agentId) || null;
  }

  list() {
    return Array.from(this.agents.values());
  }

  can(agentId, permission) {
    const agent = this.get(agentId);
    if (!agent) return false;

    const mapping = {
      prepare: 'may_prepare',
      humanApprove: 'may_human_approve',
      release: 'may_release',
    };
    const field = mapping[permission];
    return field ? agent[field] === true : false;
  }

  provides(agentId, capability) {
    const agent = this.get(agentId);
    return Boolean(agent && agent.capabilities.includes(capability));
  }
}

module.exports = AgentGovernanceCatalog;
