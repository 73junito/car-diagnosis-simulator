/**
 * Shared simulation engine, domain registry and orchestrator dispatch.
 *
 * The engine is domain-agnostic: it dispatches to whichever adapter is
 * registered for a domain. No laboratory routing is encoded here, and adding a
 * future mechanical, hydraulic, thermal, powertrain, network-control,
 * vehicle-dynamics or integrated-diagnostics adapter requires no change to this
 * file.
 */

import type {
  DispatchOutcome,
  DomainAdapter,
  DomainRegistry,
  SimulationEngine,
  SimulationRequest,
  SimulationResult
} from '../../contracts/engine';
import type { DomainId, FailureDetail } from '../../contracts/primitives';

export const DOMAIN_REGISTRY_VERSION = '1.0.0';

/** The eight coordinated domains. Declared, not necessarily implemented. */
export const DECLARED_DOMAIN_IDS: readonly DomainId[] = [
  'electrical',
  'mechanical',
  'hydraulic',
  'thermal',
  'powertrain',
  'network-control',
  'vehicle-dynamics',
  'integrated-diagnostics'
];

function refusal(
  code: FailureDetail['code'],
  stage: FailureDetail['stage'],
  axis: FailureDetail['axis'],
  message: string,
  detail: Readonly<Record<string, unknown>> = {}
): FailureDetail {
  return { code, axis, stage, message, residuals: null, detail };
}

/** Creates a declarative domain registry. Registration does not imply implementation. */
export function createDomainRegistry(adapters: readonly DomainAdapter[] = []): DomainRegistry {
  const byDomain = new Map<DomainId, DomainAdapter>();
  for (const adapter of adapters) byDomain.set(adapter.domainId, adapter);

  return {
    registryVersion: DOMAIN_REGISTRY_VERSION,
    declaredDomains: DECLARED_DOMAIN_IDS,
    register: (adapter: DomainAdapter) => {
      byDomain.set(adapter.domainId, adapter);
    },
    get: (domainId: DomainId) => byDomain.get(domainId) ?? null,
    list: () => [...byDomain.values()]
  };
}

/**
 * Dispatches a request to a domain adapter.
 *
 * A refusal is a successful dispatch: the orchestrator reports that the domain
 * could not answer rather than substituting another domain's physics.
 */
export function dispatchToDomain(
  registry: DomainRegistry,
  domainId: DomainId,
  request: SimulationRequest
): DispatchOutcome {
  const adapter = registry.get(domainId);
  if (!adapter) {
    const required = request.measurementRequests.some((entry) => entry.kind === 'diagnostic-data')
      ? null
      : domainId;
    if (required === null) {
      return {
        kind: 'refused',
        failure: refusal(
          'TOPOLOGY_UNSUPPORTED',
          'assembly',
          'physical',
          `no adapter is registered for domain ${domainId}`,
          { domainId }
        )
      };
    }
    return {
      kind: 'routing-required',
      requiredDomainAdapter: domainId,
      reason: `no adapter is registered for domain ${domainId}`
    };
  }

  const unsupported = request.measurementRequests.filter(
    (entry) => !adapter.capability.supportedMeasurementTypes.includes(entry.measurementType)
  );
  if (unsupported.length > 0) {
    return {
      kind: 'refused',
      failure: refusal(
        'TOOL_CAPABILITY',
        'request',
        'physical',
        `domain ${domainId} does not support ${unsupported.map((entry) => entry.measurementType).join(', ')}`,
        { domainId, unsupported: unsupported.map((entry) => entry.measurementId) }
      )
    };
  }

  return { kind: 'dispatched', domainId, result: adapter.solve(request) };
}

/** Creates the single engine facade over a domain registry. */
export function createSimulationEngine(registry: DomainRegistry): SimulationEngine {
  const adapters = () => registry.list();

  return {
    engineId: 'autolearnpro-simulation-engine',
    engineVersion: DOMAIN_REGISTRY_VERSION,
    domains: registry.declaredDomains,
    supports: (domainId: DomainId) => registry.get(domainId) !== null,
    capabilityFor: (domainId: DomainId) => registry.get(domainId)?.capability ?? null,
    solve: (request: SimulationRequest): SimulationResult => {
      const adapter = adapters().find((candidate) =>
        candidate.capability.supportedMeasurementTypes.some((type) =>
          request.measurementRequests.some((entry) => entry.measurementType === type)
        )
      );
      if (!adapter) {
        return {
          ok: false,
          requestId: request.requestId,
          failure: refusal(
            'ROUTING_REQUIRED',
            'request',
            'physical',
            'no registered adapter can serve this request',
            { requestId: request.requestId }
          ),
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
      return adapter.solve(request);
    }
  };
}
