'use strict';

const crypto = require('crypto');
const foundation = require('../../../data/architecture/agent-orchestration-foundation.json');
const WorkflowStateMachine = require('../governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../governance/agent-governance-catalog');
const RunLedger = require('../governance/run-ledger');

class GovernanceRuntime {
  constructor(options = {}) {
    const definition = options.definition || foundation;
    this.store = options.store || null;
    this.stateMachine = options.stateMachine || new WorkflowStateMachine(definition);
    this.catalog = options.catalog || new AgentGovernanceCatalog(definition);
    this.ledger = options.ledger || new RunLedger({ store: this.store });
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
    const existing = this.ledger.list({ runId }).find(
      (entry) =>
        entry.action === 'step-started' &&
        entry.metadata &&
        entry.metadata.requestId === requestId
    );

    if (existing) {
      return existing;
    }

    const entry = this.ledger.append({
      runId,
      actor: agentId,
      action: 'step-started',
      state: from,
      metadata: { capability, from, to, requestId },
    });

    this.writeCheckpoint(runId, entry, 'in-progress');
    return entry;
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

    const entry = this.ledger.append({
      runId,
      actor: agentId,
      action: 'step-finished',
      state: to,
      metadata: { capability, from, to, requestId },
    });

    this.writeCheckpoint(runId, entry, 'step-completed');
    return entry;
  }

  recordHandoff({
    runId,
    fromAgentId,
    toAgentId,
    capability,
    state,
    handoffId = null,
  }) {
    if (handoffId) {
      const existing = this.ledger.list({ runId }).find(
        (entry) =>
          entry.action === 'handoff-recorded' &&
          entry.metadata &&
          entry.metadata.handoffId === handoffId
      );

      if (existing) {
        return existing;
      }
    }

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

    const entry = this.ledger.append({
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

    this.writeCheckpoint(runId, entry, 'awaiting-handoff');
    return entry;
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

    if (approvalEvidence) {
      const existing = this.ledger.list({ runId }).find(
        (entry) =>
          entry.action === 'human-approval-recorded' &&
          entry.metadata &&
          entry.metadata.approvalEvidence === approvalEvidence
      );

      if (existing) {
        return existing;
      }
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

    const entry = this.ledger.append({
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

    this.writeCheckpoint(runId, entry, 'human-approved');
    return entry;
  }

  writeCheckpoint(runId, entry, status) {
    if (!this.store || typeof this.store.writeCheckpoint !== 'function') {
      return null;
    }

    return this.store.writeCheckpoint(runId, {
      runId,
      state: entry.state,
      status,
      action: entry.action,
      actor: entry.actor,
      recordedAt: entry.recordedAt,
      metadata: { ...(entry.metadata || {}) },
    });
  }

  recoverRun(runId) {
    const latest = this.ledger.latest(runId);
    if (!latest) {
      return null;
    }

    const statusByAction = {
      'step-started': 'interrupted',
      'step-finished': 'step-completed',
      'handoff-recorded': 'awaiting-handoff',
      'human-approval-recorded': 'human-approved',
    };

    const recovery = {
      runId,
      state: latest.state,
      action: latest.action,
      status: statusByAction[latest.action] || 'unknown',
      resumable: true,
      metadata: { ...(latest.metadata || {}) },
    };

    const checkpoint =
      this.store && typeof this.store.readCheckpoint === 'function'
        ? this.store.readCheckpoint(runId)
        : null;

    if (
      this.store &&
      (!checkpoint ||
        checkpoint.state !== recovery.state ||
        checkpoint.action !== recovery.action)
    ) {
      this.store.writeCheckpoint(runId, recovery);
    }

    return recovery;
  }

  getRun(runId) {
    return this.ledger.list({ runId });
  }
}

module.exports = GovernanceRuntime;
