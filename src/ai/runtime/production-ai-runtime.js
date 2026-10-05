'use strict';

const AIOrchestrator = require('./ai-orchestrator');
const PersistentGovernanceRuntime = require('./persistent-governance-runtime');
const {
  createProductionPersistenceRuntime,
} = require('./production-persistence-runtime');

function createProductionAIOrchestrator({
  env = {},
  workerId,
  leaseMs = 30000,
  registry,
  eventBus,
  scheduler,
  maxConcurrent,
  maxQueueDepth,
  createClientImpl,
} = {}) {
  const persistence = createProductionPersistenceRuntime({
    env,
    workerId,
    leaseMs,
    createClientImpl,
  });

  if (!persistence.enabled) {
    return {
      persistence,
      governanceRuntime: null,
      orchestrator: new AIOrchestrator({
        registry,
        eventBus,
        scheduler,
        maxConcurrent,
        maxQueueDepth,
      }),
    };
  }

  const governanceRuntime = new PersistentGovernanceRuntime({
    coordinator: persistence.coordinator,
  });

  return {
    persistence,
    governanceRuntime,
    orchestrator: new AIOrchestrator({
      registry,
      eventBus,
      scheduler,
      maxConcurrent,
      maxQueueDepth,
      governanceRuntime,
    }),
  };
}

module.exports = {
  createProductionAIOrchestrator,
};
