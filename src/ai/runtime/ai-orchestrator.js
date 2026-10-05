const crypto = require('crypto');

const AgentProcess = require('../kernel/agent-process');
const SchedulerKernel = require('../kernel/scheduler-kernel');
const AgentRegistry = require('../registry/agent-registry');
const RuntimeEventBus = require('../events/runtime-event-bus');
const GovernanceRuntime = require('./governance-runtime');

/**
 * Public entry point for the TorqueMind product AI runtime.
 *
 * The orchestrator:
 * - resolves an agent from a capability
 * - creates a schedulable AgentProcess
 * - submits work to SchedulerKernel
 * - exposes lifecycle and result inspection
 */
class AIOrchestrator {
  constructor({
    registry = new AgentRegistry(),
    eventBus = new RuntimeEventBus(),
    scheduler = null,
    maxConcurrent = 1,
    maxQueueDepth = 100,
    governanceRuntime = null,
  } = {}) {
    this.registry = registry;
    this.eventBus = eventBus;
    this.governanceRuntime = governanceRuntime || new GovernanceRuntime();
    this.scheduler =
      scheduler ||
      new SchedulerKernel({
        maxConcurrent,
        maxQueueDepth,
        eventBus,
      });

    this.requests = new Map();
  }

  registerAgent(agent) {
    const registered = this.registry.register(agent);

    this.eventBus.publish('agent.registered', {
      agent: {
        id: registered.id,
        name: registered.name || registered.id,
        capabilities: registered.capabilities,
      },
    });

    return registered;
  }

  unregisterAgent(agentId) {
    const removed = this.registry.unregister(agentId);

    if (removed) {
      this.eventBus.publish('agent.unregistered', {
        agentId,
      });
    }

    return removed;
  }

  submit({
    id = null,
    capability,
    input = {},
    context = {},
    agentId = null,
    priority = null,
    quota = 10,
    timeSliceMs = 1000,
    metadata = {},
    governed = null,
  }) {
    if (!capability || typeof capability !== 'string') {
      throw new Error('submit requires a non-empty capability');
    }

    const agent = this.registry.resolve(capability, { agentId });
    const requestId = id || this.createRequestId();

    if (governed) {
      this.governanceRuntime.checkStep({
        runId: governed.runId,
        agent,
        capability,
        from: governed.from,
        to: governed.to,
      });
    }

    if (this.requests.has(requestId) || this.scheduler.getProcess(requestId)) {
      throw new Error(`Request ${requestId} already exists`);
    }

    const process = new AgentProcess({
      id: requestId,
      name: `${agent.name || agent.id}: ${capability}`,
      agentId: agent.id,
      capability,
      priority:
        priority === null || typeof priority === 'undefined'
          ? Number(agent.defaultPriority || 1)
          : priority,
      quota,
      timeSliceMs,
      metadata,
      task: async (runtimeContext, currentProcess) => {
        const result = await agent.execute({
          input,
          context: {
            ...context,
            ...runtimeContext,
          },
          process: currentProcess,
          orchestrator: this,
          eventBus: this.eventBus,
        });

        if (governed) {
          this.governanceRuntime.recordFinish({
            runId: governed.runId,
            agentId: agent.id,
            capability,
            from: governed.from,
            to: governed.to,
            requestId,
          });
        }

        return result;
      },
    });

    this.requests.set(requestId, {
      id: requestId,
      capability,
      agentId: agent.id,
      input,
      context,
      metadata,
      governed,
      createdAt: new Date().toISOString(),
    });

    if (governed) {
      this.governanceRuntime.recordStart({
        runId: governed.runId,
        agentId: agent.id,
        capability,
        from: governed.from,
        to: governed.to,
        requestId,
      });
    }

    this.scheduler.enqueue(process);

    this.eventBus.publish('request.submitted', {
      requestId,
      capability,
      agentId: agent.id,
      priority: process.priority,
      governed: Boolean(governed),
      runId: governed ? governed.runId : null,
    });

    return process.getStatusSummary();
  }

  async tick(context = {}) {
    return this.scheduler.tick(context);
  }

  async drain(context = {}, options = {}) {
    return this.scheduler.drain(context, options);
  }

  resume(requestId, options = {}) {
    return this.scheduler.resume(requestId, options);
  }

  getRequest(requestId) {
    const request = this.requests.get(requestId) || null;
    const process = this.scheduler.getProcess(requestId);

    if (!request && !process) {
      return null;
    }

    return {
      request,
      process:
        process && typeof process.getStatusSummary === 'function'
          ? process.getStatusSummary()
          : null,
    };
  }

  getRunLedger(runId) {
    return this.governanceRuntime.getRun(runId);
  }

  getStats() {
    return {
      registeredAgents: this.registry.list().length,
      requests: this.requests.size,
      scheduler: this.scheduler.getStats(),
    };
  }

  createRequestId() {
    if (typeof crypto.randomUUID === 'function') {
      return `ai-request-${crypto.randomUUID()}`;
    }

    return `ai-request-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

module.exports = AIOrchestrator;
