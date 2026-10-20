'use strict';

/**
 * Worker execution-path tests.
 *
 * Execution failures must be distinguishable from numerical failures, and no
 * numeric value may be produced on any execution-failure path.
 */

const simulation = require('../src/simulation');

function makeFakeWorker() {
  const worker = {
    sent: [],
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(message) {
      worker.sent.push(message);
    },
    terminate() {
      worker.terminated = true;
    }
  };
  return worker;
}

const request = {
  requestId: 'req-1',
  labId: 'starting-system-lab',
  manifestId: 'manifest.starting-system.v2',
  modelId: 'automotive-12v-starting-system',
  modelVersion: '2.0.0',
  modelRef: 'data/circuit-templates/12v-starting-system-v2.json',
  operatingStateId: 'crank',
  faultScenarioIds: [],
  measurementRequests: []
};

const successResult = {
  ok: true,
  requestId: 'req-1',
  quantities: [],
  residuals: { infinityNorm: 0, iterations: 0, tolerance: 1e-9 },
  excludedElements: [],
  warnings: [],
  provenance: {
    manifestId: 'manifest.starting-system.v2',
    modelId: 'automotive-12v-starting-system',
    modelVersion: '2.0.0',
    solverVersion: simulation.ELECTRICAL_SOLVER_VERSION,
    engine: 'mna-worker',
    deterministic: true
  }
};

function makeClient(overrides = {}) {
  return simulation.createEngineClient({
    fallbackSolve: () => successResult,
    nodeCount: () => 5,
    models: [],
    ...overrides
  });
}

describe('worker execution client', () => {
  test('sends an init message and reports the worker execution path', () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    expect(client.executionPath()).toBe('worker');
    expect(worker.sent[0].type).toBe('init');
    expect(worker.sent[0].payload.protocolVersion).toBe(simulation.WORKER_PROTOCOL_VERSION);
    client.dispose();
  });

  test('routes a worker result back to the caller', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    const promise = client.solve(request);
    const solveMessage = worker.sent.find((message) => message.type === 'solve');
    expect(solveMessage).toBeDefined();
    worker.onmessage({
      data: { type: 'result', requestId: solveMessage.requestId, payload: successResult }
    });
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.provenance.engine).toBe('mna-worker');
    client.dispose();
  });

  test('routes a worker error back with worker provenance', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    const promise = client.solve(request);
    const solveMessage = worker.sent.find((message) => message.type === 'solve');
    worker.onmessage({
      data: {
        type: 'error',
        requestId: solveMessage.requestId,
        payload: {
          code: 'TOPOLOGY_UNSUPPORTED',
          axis: 'physical',
          stage: 'assembly',
          message: 'refused',
          residuals: null,
          detail: {}
        }
      }
    });
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('TOPOLOGY_UNSUPPORTED');
    expect(result.provenance.engine).toBe('mna-worker');
    client.dispose();
  });

  test('a worker that never answers produces a timeout, not a numerical failure', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker, timeoutMs: 5 });
    const result = await client.solve(request);
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('WORKER_TIMEOUT');
    expect(result.failure.axis).toBe('execution');
    expect(result.failure.stage).toBe('execution');
    expect(result.failure.residuals).toBeNull();
    // The superseded request is cancelled on the worker side.
    expect(worker.sent.some((message) => message.type === 'cancel')).toBe(true);
    client.dispose();
  });

  test('cancelling a pending request resolves it as cancelled control flow', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    const promise = client.solve(request);
    const solveMessage = worker.sent.find((message) => message.type === 'solve');
    client.cancel(solveMessage.requestId);
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('WORKER_CANCELLED');
    expect(result.failure.axis).toBe('execution');
    expect(result.failure.residuals).toBeNull();
    client.dispose();
  });

  test('without a worker a small network is solved by the controlled fallback', async () => {
    let fallbackCalls = 0;
    const client = makeClient({
      workerFactory: () => null,
      fallbackSolve: () => {
        fallbackCalls += 1;
        return successResult;
      }
    });
    expect(client.executionPath()).toBe('fallback');
    const result = await client.solve(request);
    expect(result.ok).toBe(true);
    expect(fallbackCalls).toBe(1);
    client.dispose();
  });

  test('without a worker a large network is refused rather than blocking the interface', async () => {
    let fallbackCalls = 0;
    const client = makeClient({
      workerFactory: () => null,
      maxNodesForFallback: 40,
      nodeCount: () => 500,
      fallbackSolve: () => {
        fallbackCalls += 1;
        return successResult;
      }
    });
    const result = await client.solve(request);
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('WORKER_UNAVAILABLE');
    expect(result.failure.axis).toBe('execution');
    expect(fallbackCalls).toBe(0);
    client.dispose();
  });

  test('a worker factory that throws falls back instead of crashing', async () => {
    const client = makeClient({
      workerFactory: () => {
        throw new Error('workers are not available here');
      }
    });
    expect(client.executionPath()).toBe('fallback');
    const result = await client.solve(request);
    expect(result.ok).toBe(true);
    client.dispose();
  });

  test('a worker initialisation failure is reported as an execution failure', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    const promise = client.solve(request);
    worker.onerror(new Error('init failed'));
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('WORKER_INIT_FAILED');
    expect(result.failure.axis).toBe('execution');
    expect(client.executionPath()).toBe('unavailable');
    client.dispose();
  });

  test('disposing terminates the worker and refuses further requests', async () => {
    const worker = makeFakeWorker();
    const client = makeClient({ workerFactory: () => worker });
    client.dispose();
    expect(worker.terminated).toBe(true);
    const result = await client.solve(request);
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('WORKER_UNAVAILABLE');
  });
});
