/**
 * Worker protocol and main-thread execution client.
 *
 * Execution failures are kept strictly separate from numerical failures: a
 * timeout or a missing worker never reports a numerical code, and no numeric
 * value is returned on any execution-failure path.
 */

import type { EngineCapability, SimulationRequest, SimulationResult } from '../../contracts/engine';
import type { ModelManifest, ModelState, FaultScenario, RelayCoupling } from '../../contracts/model';
import type { FailureDetail } from '../../contracts/primitives';

export const WORKER_PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_SOLVE_TIMEOUT_MS = 2000;
export const DEFAULT_FALLBACK_NODE_LIMIT = 40;

/** Model data a worker needs in order to solve without further I/O. */
export interface WorkerModelRegistration {
  readonly modelRef: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly manifest: ModelManifest;
  readonly capability: EngineCapability;
  readonly template: unknown;
  readonly operatingStates: readonly ModelState[];
  readonly faultScenarios: readonly FaultScenario[];
  readonly relayCouplings: readonly RelayCoupling[];
  readonly declaredToolIds: readonly string[];
  readonly toolMeasurementTypes: Readonly<Record<string, readonly string[]>>;
}

export interface WorkerInitRequest {
  readonly type: 'init';
  readonly payload: {
    readonly protocolVersion: string;
    readonly models: readonly WorkerModelRegistration[];
  };
}

export interface WorkerSolveRequest {
  readonly type: 'solve';
  readonly requestId: string;
  readonly payload: SimulationRequest;
}

export interface WorkerCancelRequest {
  readonly type: 'cancel';
  readonly requestId: string;
}

export type WorkerRequest = WorkerInitRequest | WorkerSolveRequest | WorkerCancelRequest;

export interface WorkerReadyResponse {
  readonly type: 'ready';
  readonly payload: { readonly protocolVersion: string; readonly modelCount: number };
}

export interface WorkerResultResponse {
  readonly type: 'result';
  readonly requestId: string;
  readonly payload: SimulationResult;
}

export interface WorkerErrorResponse {
  readonly type: 'error';
  readonly requestId: string;
  readonly payload: FailureDetail;
}

export type WorkerResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;

/** Minimal structural view of a Worker, so tests can inject a fake. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type ExecutionPath = 'worker' | 'fallback' | 'unavailable';

export interface EngineClientOptions {
  /** Returns a worker, or null when the platform cannot provide one. */
  readonly workerFactory?: () => WorkerLike | null;
  readonly timeoutMs?: number;
  /** Requests above this node count are not attempted on the main thread. */
  readonly maxNodesForFallback?: number;
  /** Synchronous solver used when no worker is available. */
  readonly fallbackSolve: (request: SimulationRequest) => SimulationResult;
  /** Estimated node count, used to decide whether fallback is permitted. */
  readonly nodeCount: (request: SimulationRequest) => number;
  readonly models: readonly WorkerModelRegistration[];
}

export interface EngineClient {
  readonly solve: (request: SimulationRequest) => Promise<SimulationResult>;
  readonly cancel: (requestId: string) => void;
  readonly dispose: () => void;
  readonly executionPath: () => ExecutionPath;
}

function executionFailure(
  requestId: string,
  request: SimulationRequest,
  code: FailureDetail['code'],
  message: string,
  detail: Readonly<Record<string, unknown>> = {}
): SimulationResult {
  return {
    ok: false,
    requestId,
    failure: {
      code,
      axis: 'execution',
      stage: 'execution',
      message,
      // No valid solution was produced, so no residual can exist.
      residuals: null,
      detail
    },
    provenance: {
      manifestId: request.manifestId,
      modelId: request.modelId,
      modelVersion: request.modelVersion,
      solverVersion: null,
      engine: 'none',
      deterministic: true
    }
  };
}

/**
 * Creates the execution client.
 *
 * When a worker is available the solve runs off the main thread. When it is not,
 * a synchronous solve is permitted only for small networks; larger requests are
 * refused rather than blocking the interface.
 */
export function createEngineClient(options: EngineClientOptions): EngineClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SOLVE_TIMEOUT_MS;
  const fallbackLimit = options.maxNodesForFallback ?? DEFAULT_FALLBACK_NODE_LIMIT;

  let worker: WorkerLike | null = null;
  let path: ExecutionPath = 'fallback';
  let disposed = false;
  let counter = 0;
  const pending = new Map<
    string,
    {
      readonly resolve: (result: SimulationResult) => void;
      readonly timer: ReturnType<typeof setTimeout>;
      readonly request: SimulationRequest;
    }
  >();

  if (options.workerFactory) {
    try {
      worker = options.workerFactory();
    } catch {
      worker = null;
    }
  }

  if (worker) {
    path = 'worker';
    worker.onmessage = (event) => {
      const message = event.data as WorkerResponse | null;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') return;
      const entry = pending.get(message.requestId);
      if (!entry) return;
      pending.delete(message.requestId);
      clearTimeout(entry.timer);
      if (message.type === 'result') {
        entry.resolve(message.payload);
        return;
      }
      entry.resolve({
        ok: false,
        requestId: message.requestId,
        failure: message.payload,
        provenance: {
          manifestId: entry.request.manifestId,
          modelId: entry.request.modelId,
          modelVersion: entry.request.modelVersion,
          solverVersion: null,
          engine: 'mna-worker',
          deterministic: true
        }
      });
    };
    worker.onerror = () => {
      // A worker that fails to initialise cannot answer. Refuse rather than
      // silently falling back, so the execution path stays visible.
      path = 'unavailable';
      worker = null;
      for (const [requestId, entry] of pending) {
        pending.delete(requestId);
        clearTimeout(entry.timer);
        entry.resolve(
          executionFailure(requestId, entry.request, 'WORKER_INIT_FAILED', 'the simulation worker failed')
        );
      }
    };
    worker.postMessage({
      type: 'init',
      payload: { protocolVersion: WORKER_PROTOCOL_VERSION, models: options.models }
    } satisfies WorkerInitRequest);
  }

  const solve = async (request: SimulationRequest): Promise<SimulationResult> => {
    if (disposed) {
      return executionFailure(request.requestId, request, 'WORKER_UNAVAILABLE', 'the engine client has been disposed');
    }

    if (!worker) {
      const nodes = options.nodeCount(request);
      if (nodes > fallbackLimit) {
        return executionFailure(
          request.requestId,
          request,
          'WORKER_UNAVAILABLE',
          `no worker is available and this network has ${nodes} nodes, above the ${fallbackLimit} node fallback limit`
        );
      }
      return options.fallbackSolve(request);
    }

    counter += 1;
    const requestId = `${request.requestId}#${counter}`;

    return await new Promise<SimulationResult>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        worker?.postMessage({ type: 'cancel', requestId } satisfies WorkerCancelRequest);
        resolve(
          executionFailure(
            request.requestId,
            request,
            'WORKER_TIMEOUT',
            `the solve exceeded the ${timeoutMs} ms budget and was stopped`
          )
        );
      }, timeoutMs);

      pending.set(requestId, { resolve, timer, request });
      worker?.postMessage({ type: 'solve', requestId, payload: request } satisfies WorkerSolveRequest);
    });
  };

  const cancel = (requestId: string): void => {
    // Accept either the internal request id or the caller's original request id.
    let key = requestId;
    if (!pending.has(key)) {
      for (const [candidate, entry] of pending) {
        if (entry.request.requestId === requestId) {
          key = candidate;
          break;
        }
      }
    }
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    clearTimeout(entry.timer);
    // Cancellation is normal control flow, not an error surfaced to a student.
    entry.resolve(
      executionFailure(entry.request.requestId, entry.request, 'WORKER_CANCELLED', 'superseded by a newer request')
    );
    worker?.postMessage({ type: 'cancel', requestId: key } satisfies WorkerCancelRequest);
  };

  return {
    solve,
    cancel,
    dispose: () => {
      disposed = true;
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    },
    executionPath: () => path
  };
}
