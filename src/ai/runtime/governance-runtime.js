'use strict';

const foundation = require('../../../data/architecture/agent-orchestration-foundation.json');
const WorkflowStateMachine = require('../governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../governance/agent-governance-catalog');
const RunLedger = require('../governance/run-ledger');

class GovernanceRuntime {
  constructor(options = {}) {
    const definition = options.definition || foundation;
    this.stateMachine = options.stateMachine || new WorkflowStateMachine(definition);
    this.catalog = options.catalog || new AgentGovernanceCatalog(definition);
    this.ledger = options.ledger || new RunLedger();
  }

  checkStep({ runId, agent, capability, from, to }) {
    if (!runId || !agent || !capability || !from || !to) {
      throw new Error('Governed step is incomplete');
    }

    if (!this.catalog.get(agent.id) || !this.catalog.can(agent.id, 'prepare')) {
      throw new Error('Governed agent is not permitted');
    }

    if (!this.catalog.provides(agent.id, capability)) {
      throw new Error('Governed capability is not permitted');
    }

    const latest = this.ledger.latest(runId);
    if (latest && latest.state !== from) {
      throw new Error('Governed run state does not match latest ledger state');
    }

    const decision = this.stateMachine.canTransition({
      from,
      to,
      actor: agent.id,
    });

    if (!decision.allowed) {
      throw new Error('Governed transition denied: ' + decision.reason);
    }

    return decision;
  }

  recordStart({ runId, agentId, capability, from, to, requestId }) {
    return this.ledger.append({
      runId,
      actor: agentId,
      action: 'step-started',
      state: from,
      metadata: { capability, from, to, requestId },
    });
  }

  recordFinish({ runId, agentId, capability, from, to, requestId }) {
    const existing = this.ledger.list({ runId }).find(
      (entry) =>
        entry.action === 'step-finished' &&
        entry.metadata &&
        entry.metadata.requestId === requestId
    );

    if (existing) {
      return existing;
    }

    return this.ledger.append({
      runId,
      actor: agentId,
      action: 'step-finished',
      state: to,
      metadata: { capability, from, to, requestId },
    });
  }

  getRun(runId) {
    return this.ledger.list({ runId });
  }
}

module.exports = GovernanceRuntime;
