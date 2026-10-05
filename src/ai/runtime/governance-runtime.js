'use strict';

const crypto = require('crypto');
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

  checkStep({ runId, agent, capability, from, to, handoffId = null }) {
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

    if (latest && latest.action === 'handoff-recorded') {
      const handoff = latest.metadata || {};
      if (
        !handoffId ||
        handoff.handoffId !== handoffId ||
        handoff.toAgentId !== agent.id ||
        handoff.capability !== capability
      ) {
        throw new Error('Governed handoff does not authorize this step');
      }
    } else if (handoffId) {
      throw new Error('Governed handoff record is not current');
    } else if (
      latest &&
      latest.action === 'step-finished' &&
      latest.actor !== agent.id
    ) {
      throw new Error('Governed agent-to-agent handoff is required');
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

  recordHandoff({
    runId,
    fromAgentId,
    toAgentId,
    capability,
    state,
    handoffId = null,
  }) {
    const latest = this.ledger.latest(runId);

    if (
      !latest ||
      latest.action !== 'step-finished' ||
      latest.actor !== fromAgentId ||
      latest.state !== state
    ) {
      throw new Error('Handoff must follow the completed source-agent step');
    }

    if (!this.catalog.get(toAgentId)) {
      throw new Error('Handoff target agent is not governed');
    }

    if (!this.catalog.provides(toAgentId, capability)) {
      throw new Error('Handoff target capability is not governed');
    }

    const id =
      handoffId ||
      (typeof crypto.randomUUID === 'function'
        ? `handoff-${crypto.randomUUID()}`
        : `handoff-${Date.now()}`);

    return this.ledger.append({
      runId,
      actor: fromAgentId,
      action: 'handoff-recorded',
      state,
      metadata: {
        handoffId: id,
        fromAgentId,
        toAgentId,
        capability,
      },
    });
  }

  recordHumanTransition({
    runId,
    from,
    to,
    reviewerIdentity,
    reviewedAt,
    runtimeVerified = false,
    approvalEvidence = null,
  }) {
    if (!runId || !reviewerIdentity || !reviewedAt) {
      throw new Error('Human approval record is incomplete');
    }

    const latest = this.ledger.latest(runId);
    if (latest && latest.state !== from) {
      throw new Error('Human approval state does not match latest ledger state');
    }

    const decision = this.stateMachine.canTransition({
      from,
      to,
      actor: 'human',
      explicitHumanApproval: true,
      runtimeVerified,
    });

    if (!decision.allowed) {
      throw new Error('Human transition denied: ' + decision.reason);
    }

    return this.ledger.append({
      runId,
      actor: 'human',
      action: 'human-approval-recorded',
      state: to,
      metadata: {
        from,
        to,
        reviewerIdentity,
        reviewedAt,
        runtimeVerified: runtimeVerified === true,
        approvalEvidence,
      },
    });
  }

  getRun(runId) {
    return this.ledger.list({ runId });
  }
}

module.exports = GovernanceRuntime;
