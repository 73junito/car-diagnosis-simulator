'use strict';

const crypto = require('crypto');
const foundation = require('../../../data/architecture/agent-orchestration-foundation.json');
const WorkflowStateMachine = require('../governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../governance/agent-governance-catalog');

class PersistentGovernanceRuntime {
  constructor({ coordinator, definition = foundation, stateMachine, catalog } = {}) {
    if (!coordinator) throw new Error('PersistentGovernanceRuntime requires coordinator');
    this.coordinator = coordinator;
    this.stateMachine = stateMachine || new WorkflowStateMachine(definition);
    this.catalog = catalog || new AgentGovernanceCatalog(definition);
  }

  async entries(runId) {
    return this.coordinator.store.loadEntries(runId);
  }

  async latest(runId) {
    const entries = await this.entries(runId);
    return entries.length ? entries[entries.length - 1] : null;
  }

  validateStep({ runId, agent, capability, from, to, handoffId = null, latest }) {
    if (!runId || !agent || !capability || !from || !to) throw new Error('Governed step is incomplete');
    if (!this.catalog.get(agent.id) || !this.catalog.can(agent.id, 'prepare')) throw new Error('Governed agent is not permitted');
    if (!this.catalog.provides(agent.id, capability)) throw new Error('Governed capability is not permitted');
    if (latest && latest.state !== from) throw new Error('Governed run state does not match latest ledger state');

    if (latest && latest.action === 'handoff-recorded') {
      const handoff = latest.metadata || {};
      if (!handoffId || handoff.handoffId !== handoffId || handoff.toAgentId !== agent.id || handoff.capability !== capability) {
        throw new Error('Governed handoff does not authorize this step');
      }
    } else if (handoffId) {
      throw new Error('Governed handoff record is not current');
    } else if (latest && latest.action === 'step-finished' && latest.actor !== agent.id) {
      throw new Error('Governed agent-to-agent handoff is required');
    }

    const decision = this.stateMachine.canTransition({ from, to, actor: agent.id });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);
    return decision;
  }

  async checkStep(step) {
    const latest = await this.latest(step.runId);
    if (!latest) {
      throw new Error('Persistent governed run requires prior governance state');
    }
    return this.validateStep({ ...step, latest });
  }

  async findByRequest(runId, action, requestId) {
    const entries = await this.entries(runId);
    return entries.find((entry) =>
      entry.action === action &&
      entry.metadata &&
      entry.metadata.requestId === requestId
    ) || null;
  }

  async appendAndCheckpoint(entry) {
    const appended = await this.coordinator.append(entry);
    await this.coordinator.recover(entry.runId);
    return appended;
  }

  async recordStart({ runId, agentId, capability, from, to, requestId }) {
    const existing = await this.findByRequest(runId, 'step-started', requestId);
    if (existing) return existing;
    return this.appendAndCheckpoint({
      runId,
      actor: agentId,
      action: 'step-started',
      state: from,
      metadata: { capability, from, to, requestId },
    });
  }

  async recordFinish({ runId, agentId, capability, from, to, requestId }) {
    const existing = await this.findByRequest(runId, 'step-finished', requestId);
    if (existing) return existing;
    return this.appendAndCheckpoint({
      runId,
      actor: agentId,
      action: 'step-finished',
      state: to,
      metadata: { capability, from, to, requestId },
    });
  }

  async recordHandoff({ runId, fromAgentId, toAgentId, capability, state, handoffId = null }) {
    const entries = await this.entries(runId);
    if (handoffId) {
      const existing = entries.find((entry) =>
        entry.action === 'handoff-recorded' &&
        entry.metadata &&
        entry.metadata.handoffId === handoffId
      );
      if (existing) return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'step-finished' || latest.actor !== fromAgentId || latest.state !== state) {
      throw new Error('Handoff must follow the completed source-agent step');
    }
    if (!this.catalog.get(toAgentId)) throw new Error('Handoff target agent is not governed');
    if (!this.catalog.provides(toAgentId, capability)) throw new Error('Handoff target capability is not governed');

    const id = handoffId || (typeof crypto.randomUUID === 'function'
      ? `handoff-${crypto.randomUUID()}`
      : `handoff-${Date.now()}`);

    return this.appendAndCheckpoint({
      runId,
      actor: fromAgentId,
      action: 'handoff-recorded',
      state,
      metadata: { handoffId: id, fromAgentId, toAgentId, capability },
    });
  }

  async recordHumanTransition({ runId, from, to, reviewerIdentity, reviewedAt, runtimeVerified = false, approvalEvidence = null }) {
    if (!runId || !reviewerIdentity || !reviewedAt) throw new Error('Human approval record is incomplete');

    const entries = await this.entries(runId);
    if (approvalEvidence) {
      const existing = entries.find((entry) =>
        entry.action === 'human-approval-recorded' &&
        entry.metadata &&
        entry.metadata.approvalEvidence === approvalEvidence
      );
      if (existing) return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (latest && latest.state !== from) throw new Error('Human approval state does not match latest ledger state');

    const decision = this.stateMachine.canTransition({
      from,
      to,
      actor: 'human',
      explicitHumanApproval: true,
      runtimeVerified,
    });
    if (!decision.allowed) throw new Error('Human transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor: 'human',
      action: 'human-approval-recorded',
      state: to,
      metadata: { from, to, reviewerIdentity, reviewedAt, runtimeVerified: runtimeVerified === true, approvalEvidence },
    });
  }

  async recoverRun(runId) {
    return this.coordinator.recover(runId);
  }

  async getRun(runId) {
    return this.entries(runId);
  }
}

module.exports = PersistentGovernanceRuntime;
