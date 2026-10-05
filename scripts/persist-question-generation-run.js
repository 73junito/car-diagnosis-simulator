'use strict';

const {
  createProductionAIOrchestrator,
} = require('../src/ai/runtime/production-ai-runtime');

const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const action = args.action || '';
const runId = args['run-id'] || '';
const scenarioId = args.scenario || '';
const requestId = args['request-id'] || '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!['start', 'finish'].includes(action)) fail('--action=start|finish is required.');
if (!/^[A-Za-z0-9._:-]+$/.test(runId)) fail('A valid --run-id is required.');
if (!/^[a-z0-9-]+$/.test(scenarioId)) fail('A valid --scenario is required.');
if (!/^[A-Za-z0-9._:-]+$/.test(requestId)) fail('A valid --request-id is required.');

(async () => {
  const runtime = createProductionAIOrchestrator({
    env: process.env,
    workerId: [
      'github-actions',
      process.env.GITHUB_RUN_ID || 'local',
      process.env.GITHUB_RUN_ATTEMPT || '1',
      action,
    ].join(':'),
  });

  if (!runtime.persistence.enabled || !runtime.governanceRuntime) {
    throw new Error('Production orchestration persistence must be enabled.');
  }

  if (action === 'start') {
    runtime.orchestrator.registerAgent({
      id: 'question-agent',
      name: 'Automotive Question Drafting Agent',
      capabilities: ['question-drafting'],
      execute: async () => ({ done: true }),
    });

    await runtime.orchestrator.submitPersistentGoverned({
      id: requestId,
      capability: 'question-drafting',
      governed: {
        runId,
        from: 'final_content_approved',
        to: 'item_generated',
      },
      metadata: {
        scenarioId,
        executionBoundary: 'github-actions-private-question-generation',
      },
    });

    const latest = await runtime.governanceRuntime.latest(runId);
    if (
      !latest ||
      latest.action !== 'step-started' ||
      latest.actor !== 'question-agent' ||
      latest.state !== 'final_content_approved' ||
      latest.metadata?.requestId !== requestId
    ) {
      throw new Error('Persistent start record verification failed.');
    }

    console.log('Persistent governed question-generation start recorded.');
    return;
  }

  const latest = await runtime.governanceRuntime.latest(runId);
  if (
    !latest ||
    latest.action !== 'step-started' ||
    latest.actor !== 'question-agent' ||
    latest.state !== 'final_content_approved' ||
    latest.metadata?.requestId !== requestId
  ) {
    throw new Error('Persistent finish requires the matching step-started record.');
  }

  await runtime.governanceRuntime.recordFinish({
    runId,
    agentId: 'question-agent',
    capability: 'question-drafting',
    from: 'final_content_approved',
    to: 'item_generated',
    requestId,
  });

  const checkpoint = await runtime.governanceRuntime.recoverRun(runId);
  if (
    !checkpoint ||
    checkpoint.state !== 'item_generated' ||
    checkpoint.action !== 'step-finished' ||
    checkpoint.status !== 'step-completed'
  ) {
    throw new Error('Persistent finish checkpoint verification failed.');
  }

  console.log('Persistent governed question-generation finish recorded.');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
