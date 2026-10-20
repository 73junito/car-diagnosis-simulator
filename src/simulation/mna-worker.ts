/**
 * Web Worker entry point for the electrical solver.
 *
 * The worker holds no ambient authority: it is constructed with model data
 * supplied by the init message, it performs no network access, and it returns a
 * typed result or a typed failure for every request. The same registration and
 * dispatch functions are exported so tests can exercise the worker logic
 * without a real Worker.
 */

import { createElectricalAdapter } from './electrical-adapter';
import type { DomainAdapter } from '../../contracts/engine';
import {
  WORKER_PROTOCOL_VERSION,
  type WorkerModelRegistration,
  type WorkerRequest,
  type WorkerResponse
} from './worker';

const adapters = new Map<string, DomainAdapter>();

/** Registers a model and returns the adapter that serves it. */
export function registerModel(model: WorkerModelRegistration): DomainAdapter {
  const adapter = createElectricalAdapter({
    manifest: model.manifest,
    capability: model.capability,
    template: model.template,
    templateId: model.templateId,
    templateVersion: model.templateVersion,
    modelRef: model.modelRef,
    operatingStates: model.operatingStates,
    faultScenarios: model.faultScenarios,
    relayCouplings: model.relayCouplings,
    declaredToolIds: model.declaredToolIds,
    toolMeasurementTypes: model.toolMeasurementTypes,
    engineLabel: 'mna-worker'
  });
  adapters.set(model.modelRef, adapter);
  return adapter;
}

export function registeredModelCount(): number {
  return adapters.size;
}

export function clearModels(): void {
  adapters.clear();
}

/** Handles one protocol message. Exported so the logic is directly testable. */
export function handleWorkerRequest(message: WorkerRequest): WorkerResponse | null {
  if (!message || typeof message !== 'object') return null;

  if (message.type === 'init') {
    for (const model of message.payload.models) registerModel(model);
    return {
      type: 'ready',
      payload: { protocolVersion: WORKER_PROTOCOL_VERSION, modelCount: adapters.size }
    };
  }

  if (message.type === 'cancel') {
    // A synchronous solve cannot be interrupted mid-flight. The main-thread
    // client has already resolved the superseded request, so the result for
    // that id is discarded on receipt. Nothing further is required here.
    return null;
  }

  const request = message.payload;
  const adapter = adapters.get(request.modelRef);
  if (!adapter) {
    return {
      type: 'error',
      requestId: message.requestId,
      payload: {
        code: 'ROUTING_REQUIRED',
        axis: 'physical',
        stage: 'request',
        message: `no model is registered for ${request.modelRef}`,
        residuals: null,
        detail: { modelRef: request.modelRef }
      }
    };
  }

  return { type: 'result', requestId: message.requestId, payload: adapter.solve(request) };
}

interface WorkerScope {
  onmessage: ((event: { data: WorkerRequest }) => void) | null;
  postMessage: (message: WorkerResponse) => void;
}

/** True only inside a real Web Worker global scope. */
export function isWorkerScope(): boolean {
  const scope = globalThis as unknown as { WorkerGlobalScope?: unknown; self?: unknown };
  if (typeof scope.WorkerGlobalScope !== 'function') return false;
  if (typeof scope.self !== 'object' || scope.self === null) return false;
  return scope.self instanceof (scope.WorkerGlobalScope as new () => object);
}

/** Installs the message handler on the worker global scope. */
export function installWorkerScope(): void {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = (event: { data: WorkerRequest }) => {
    const response = handleWorkerRequest(event.data);
    if (response) scope.postMessage(response);
  };
}

if (isWorkerScope()) installWorkerScope();
