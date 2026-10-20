/**
 * Engine, domain-adapter, registry and dispatch contracts.
 *
 * Separation rule: numerical engines are isolated from vehicle communications,
 * presentation, instrumentation, evidence persistence and assessment
 * authority. An engine may compute; it may not score, publish, or conclude.
 *
 * Gate 2B defines these contracts only. No numerical engine is implemented in
 * this stage, so every dispatch result is a declared refusal, never a value.
 */

import type { DomainId, FailureDetail, ModelStatus, QuantityType, SourceRole } from './primitives';
import type { FaultScenario, ModelManifest, ModelState, RelayCoupling } from './model';
import type { ApplicabilityContext, Quantity, ValidityCondition } from './quantity';

/** Declared capability of an engine, including explicit refusals. */
export interface EngineCapability {
  readonly domainId: DomainId;
  readonly status: ModelStatus;
  readonly supportedMeasurementTypes: readonly QuantityType[];
  readonly unsupportedMeasurementTypes: readonly QuantityType[];
  /** True when the engine can report solver residuals. */
  readonly reportsResiduals: boolean;
  /** True when the engine distinguishes valid zero from unavailable. */
  readonly distinguishesUnavailableFromZero: boolean;
  readonly limitations: readonly string[];
}

/** A measurement request against a model element or node pair. */
export interface MeasurementRequest {
  readonly measurementId: string;
  readonly measurementType: QuantityType;
  readonly kind:
    | 'node-voltage'
    | 'node-to-node-voltage'
    | 'voltage-drop'
    | 'branch-current'
    | 'resistance-between'
    | 'continuity'
    | 'waveform'
    | 'power'
    | 'command-state'
    | 'diagnostic-data';
  /** A current must name exactly one resolvable branch. */
  readonly branchId?: string;
  readonly fromNode?: string;
  readonly toNode?: string;
  readonly fromTerminalId?: string;
  readonly toTerminalId?: string;
  /** Instrument requested. Must be declared for the lab in the LMF projection. */
  readonly toolId: string;
}

/** Input to a domain solve. Mode-neutral: shared by all three operating modes. */
export interface SimulationRequest {
  readonly requestId: string;
  readonly labId: string;
  readonly manifestId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  /** Repository-relative reference to the model document the solver must load. */
  readonly modelRef: string;
  readonly operatingStateId: string;
  readonly faultScenarioIds: readonly string[];
  /** Whitelisted parameter overrides only; bounds are validated by the engine. */
  readonly elementOverrides?: Readonly<Record<string, number>>;
  readonly measurementRequests: readonly MeasurementRequest[];
  readonly applicability?: ApplicabilityContext;
}

/** Result of a domain solve. */
export type SimulationResult =
  | {
      readonly ok: true;
      readonly requestId: string;
      readonly quantities: readonly Quantity[];
      readonly residuals: {
        readonly infinityNorm: number;
        readonly iterations: number;
        readonly tolerance: number;
      };
      readonly excludedElements: readonly ExcludedElement[];
      readonly warnings: readonly string[];
      readonly provenance: ResultProvenance;
    }
  | {
      readonly ok: false;
      readonly requestId: string;
      readonly failure: FailureDetail;
      /** Present on failures so evidence stays attributable. */
      readonly provenance: ResultProvenance;
    };

export interface ExcludedElement {
  readonly elementId: string;
  readonly physicalContinuity: 'galvanic' | 'coupled' | 'none';
  readonly dcModelApplicability: 'modelled' | 'excluded-by-domain' | 'unsupported';
  readonly requiredDomainAdapter: DomainId | null;
  readonly exclusionReason: string;
}

export interface ResultProvenance {
  readonly manifestId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
  readonly solverVersion: string | null;
  readonly engine: string;
  readonly deterministic: true;
}

/** A domain adapter normalises access to an authoritative model. */
export interface DomainAdapter {
  readonly adapterId: string;
  readonly domainId: DomainId;
  readonly capability: EngineCapability;
  readonly manifest: ModelManifest;
  /** Returns a declared refusal when the domain cannot answer. */
  readonly solve: (request: SimulationRequest) => SimulationResult;
  readonly listOperatingStates: () => readonly ModelState[];
  readonly listFaultScenarios: () => readonly FaultScenario[];
  readonly listRelayCouplings: () => readonly RelayCoupling[];
}

/** The single engine interface every domain implements. */
export interface SimulationEngine {
  readonly engineId: string;
  readonly engineVersion: string;
  readonly domains: readonly DomainId[];
  readonly supports: (domainId: DomainId) => boolean;
  readonly capabilityFor: (domainId: DomainId) => EngineCapability | null;
  readonly solve: (request: SimulationRequest) => SimulationResult;
}

/** Domain registry. Declarative: registration never implies implementation. */
export interface DomainRegistry {
  readonly registryVersion: string;
  readonly register: (adapter: DomainAdapter) => void;
  readonly get: (domainId: DomainId) => DomainAdapter | null;
  readonly list: () => readonly DomainAdapter[];
  readonly declaredDomains: readonly DomainId[];
}

/** Orchestrator dispatch outcome. A refusal is a successful dispatch. */
export type DispatchOutcome =
  | { readonly kind: 'dispatched'; readonly domainId: DomainId; readonly result: SimulationResult }
  | { readonly kind: 'refused'; readonly failure: FailureDetail }
  | {
      readonly kind: 'routing-required';
      readonly requiredDomainAdapter: DomainId;
      readonly reason: string;
    };

/** Cross-domain coupling declaration. */
export interface InterDomainCoupling {
  readonly couplingId: string;
  readonly fromDomainId: DomainId;
  readonly toDomainId: DomainId;
  readonly quantities: readonly QuantityType[];
  /** Quantity type and unit that must match on both sides. */
  readonly sharedQuantityType: QuantityType;
  readonly sharedUnit: string;
  /** Maximum tolerated difference between the two domains at convergence. */
  readonly convergenceTolerance: number;
  readonly convergenceBasis: 'relative' | 'absolute';
  readonly maxIterations: number;
  readonly provenanceRequired: true;
  readonly unsupportedStateBehaviour: 'fail-closed';
}

/** Describes how a value entered the platform, for evidence purposes. */
export interface SourcedValue {
  readonly value: number;
  readonly unit: string;
  readonly sourceRole: SourceRole;
  readonly validity: ValidityCondition;
}
