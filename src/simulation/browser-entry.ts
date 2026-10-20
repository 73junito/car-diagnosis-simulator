/**
 * Dual-role browser entry point.
 *
 * The same bundle serves both execution contexts:
 *   - inside a Web Worker it installs the message handler;
 *   - on the main thread it exposes the public API on the global scope.
 *
 * This keeps one artifact, one provenance label, and one code path, so a
 * browser test exercises exactly the code the worker runs.
 */

import {
  ELECTRICAL_SOLVER_VERSION,
  createElectricalAdapter,
  deriveMeasurement,
  resolveFaults,
  solveWithRelayCoupling,
  toolAllowsMeasurement
} from './electrical-adapter';
import { createDomainRegistry, createSimulationEngine, dispatchToDomain, DECLARED_DOMAIN_IDS } from './engine';
import { installWorkerScope, isWorkerScope, handleWorkerRequest } from './mna-worker';
import { solveMna, partitionNodes, solveLinearSystem } from './mna';
import { translateTemplate } from './netlist';
import {
  WORKER_PROTOCOL_VERSION,
  createEngineClient,
  DEFAULT_FALLBACK_NODE_LIMIT,
  DEFAULT_SOLVE_TIMEOUT_MS
} from './worker';

export const browserApi = {
  createEngineClient,
  createElectricalAdapter,
  createDomainRegistry,
  createSimulationEngine,
  dispatchToDomain,
  translateTemplate,
  solveMna,
  partitionNodes,
  solveLinearSystem,
  solveWithRelayCoupling,
  deriveMeasurement,
  resolveFaults,
  toolAllowsMeasurement,
  handleWorkerRequest,
  DECLARED_DOMAIN_IDS,
  WORKER_PROTOCOL_VERSION,
  ELECTRICAL_SOLVER_VERSION,
  DEFAULT_SOLVE_TIMEOUT_MS,
  DEFAULT_FALLBACK_NODE_LIMIT
};

export type BrowserApi = typeof browserApi;

if (isWorkerScope()) {
  installWorkerScope();
} else {
  (globalThis as unknown as { TorqueMindSimulation?: BrowserApi }).TorqueMindSimulation = browserApi;
}
