/**
 * Electrical domain adapter.
 *
 * Implements the shared `DomainAdapter` contract. It performs no laboratory
 * routing, performs no I/O, and holds no presentation state: it is constructed
 * with an already-loaded template and manifest, and it answers a
 * `SimulationRequest` with a `SimulationResult`.
 *
 * The adapter owns three responsibilities and nothing else:
 *   1. resolve the operating state and fault set into a translated netlist;
 *   2. resolve relay coupling from the solved coil voltage (a de-energized or
 *      unresolved coil leaves the normally-open contact electrically OPEN);
 *   3. derive requested quantities, with provenance, from the solved network.
 */

import type {
  DomainAdapter,
  EngineCapability,
  MeasurementRequest,
  SimulationRequest,
  SimulationResult
} from '../../contracts/engine';
import type { ModelManifest, ModelState, FaultScenario, RelayCoupling } from '../../contracts/model';
import type { Quantity, ResolvedValue } from '../../contracts/quantity';
import type { FailureDetail, QuantityType, Unit } from '../../contracts/primitives';
import { translateTemplate, type Netlist, type TranslationFailure } from './netlist';
import { solveMna, type MnaFailure, type MnaSuccess } from './mna';

export const ELECTRICAL_SOLVER_VERSION = '1.0.0';
export const ELECTRICAL_ADAPTER_ID = 'electrical-circuit';
export const ELECTRICAL_DOMAIN_ID = 'electrical';

/** Maximum relay fixed-point iterations before the state is declared unresolved. */
export const RELAY_MAX_ITERATIONS = 4;

interface RawFaultEntry {
  id: string;
  type: string;
  targetConnectionId?: string;
  targetComponentId?: string;
  faultClassId?: string;
}

interface RawTemplateForAdapter {
  faultCatalog?: RawFaultEntry[];
  relayCouplings?: {
    couplingId: string;
    coilElementId: string;
    contactElementId: string;
    coilControlNode: string;
    coilReturnNode: string;
    pickupVoltageV: number;
    holdVoltageV: number;
  }[];
  elementParameters?: { elementId: string; parameterId: string; value: number }[];
}

export interface ElectricalAdapterConfig {
  readonly manifest: ModelManifest;
  readonly capability: EngineCapability;
  readonly template: unknown;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly modelRef: string;
  /** Provenance label for the execution path, for example `mna-worker`. */
  readonly engineLabel?: string;
  readonly operatingStates: readonly ModelState[];
  readonly faultScenarios: readonly FaultScenario[];
  readonly relayCouplings: readonly RelayCoupling[];
  /** Tool ids the lab declares. A tool not listed here cannot be used. */
  readonly declaredToolIds: readonly string[];
  readonly toolMeasurementTypes: Readonly<Record<string, readonly string[]>>;
}

export interface FaultResolution {
  readonly removedElementIds: readonly string[];
  readonly refusal: FailureDetail | null;
}

/**
 * Resolves a fault set into element removals.
 *
 * A graded fault such as high resistance requires a declared magnitude. The
 * v2.0.0 catalogue does not declare one, so the adapter refuses rather than
 * inventing a value.
 */
export function resolveFaults(template: unknown, faultIds: readonly string[]): FaultResolution {
  const raw = template as RawTemplateForAdapter | null;
  const catalogue = raw?.faultCatalog ?? [];
  const byId = new Map(catalogue.map((entry) => [entry.id, entry]));
  const removed: string[] = [];

  for (const faultId of faultIds) {
    const entry = byId.get(faultId);
    if (!entry) {
      return {
        removedElementIds: [],
        refusal: {
          code: 'TOPOLOGY_UNSUPPORTED',
          axis: 'physical',
          stage: 'assembly',
          message: `fault ${faultId} is not present in this model's fault catalogue`,
          residuals: null,
          detail: { faultId }
        }
      };
    }
    if (entry.type === 'open_circuit') {
      const target = entry.targetConnectionId ?? entry.targetComponentId;
      if (!target) {
        return {
          removedElementIds: [],
          refusal: {
            code: 'TOPOLOGY_UNSUPPORTED',
            axis: 'physical',
            stage: 'assembly',
            message: `fault ${faultId} declares no target`,
            residuals: null,
            detail: { faultId }
          }
        };
      }
      removed.push(target);
      continue;
    }
    if (entry.type === 'high_resistance') {
      return {
        removedElementIds: [],
        refusal: {
          code: 'TOPOLOGY_UNSUPPORTED',
          axis: 'physical',
          stage: 'assembly',
          message: `fault ${faultId} is a graded resistance fault but no magnitude is declared, so no value can be computed`,
          residuals: null,
          detail: { faultId, faultClassId: entry.faultClassId ?? null, target: entry.targetConnectionId ?? null }
        }
      };
    }
    return {
      removedElementIds: [],
      refusal: {
        code: 'TOPOLOGY_UNSUPPORTED',
        axis: 'physical',
        stage: 'assembly',
        message: `fault type ${entry.type} has no validated model in this adapter`,
        residuals: null,
        detail: { faultId, faultType: entry.type }
      }
    };
  }

  return { removedElementIds: removed, refusal: null };
}

/** Maps a translation failure onto the shared failure taxonomy. */
export function translationFailureToDetail(failure: TranslationFailure): FailureDetail {
  const axis = failure.code === 'NO_REFERENCE_NODE' || failure.code === 'MULTIPLE_REFERENCE_NODES'
    ? 'numerical'
    : 'physical';
  return {
    code: failure.code === 'MISSING_PARAMETER' ? 'TOPOLOGY_UNSUPPORTED' : failure.code,
    axis,
    stage: 'assembly',
    message: failure.message,
    residuals: null,
    detail: failure.detail
  };
}

/** Maps an MNA failure onto the shared failure taxonomy. */
export function mnaFailureToDetail(failure: MnaFailure): FailureDetail {
  return {
    code: failure.code,
    axis: failure.axis,
    stage: failure.stage,
    message: failure.message,
    residuals: failure.residuals,
    detail: failure.detail
  };
}

/** Derives one requested quantity from a solved network. */
interface MeasurementOutcome {
  readonly measurementType: string;
  readonly unit: string;
  readonly resolved: ResolvedValue;
  readonly derivation: string;
}

/** Project convention: continuity is reported for a direct element below this. */
export const CONTINUITY_RESISTANCE_THRESHOLD_OHM = 1;

function unavailableOutcome(
  measurementType: string,
  unit: string,
  reason: string,
  derivation: string
): MeasurementOutcome {
  return {
    measurementType,
    unit,
    resolved: { state: 'unavailable', reason },
    derivation
  };
}

/**
 * Derives a measurement from the solved network.
 *
 * Currents always come from an element law or from the MNA source unknown. A
 * terminal pair alone is never sufficient to establish a current.
 */
export function deriveMeasurement(
  request: MeasurementRequest,
  netlist: Netlist,
  solution: MnaSuccess,
  relayState: 'closed' | 'open' | null
): MeasurementOutcome {
  const nodeOf = (terminalId: string | undefined): string | null => {
    if (!terminalId) return null;
    return netlist.terminalToNode[terminalId] ?? netlist.testPointToNode[terminalId] ?? null;
  };
  const absoluteVoltage = (nodeId: string): number | null =>
    solution.nodeVoltageAbsolute[nodeId] ?? null;

  if (request.kind === 'node-voltage') {
    const node = nodeOf(request.fromTerminalId);
    if (!node) {
      return unavailableOutcome(
        'voltage',
        'V',
        `terminal ${request.fromTerminalId ?? '(none)'} is not part of this model`,
        'request rejected: unknown terminal'
      );
    }
    const value = absoluteVoltage(node);
    if (value === null) {
      return unavailableOutcome(
        'voltage',
        'V',
        'this point has no defined potential relative to the reference',
        `node ${node} is not in the reference component (indeterminate reference)`
      );
    }
    return {
      measurementType: 'voltage',
      unit: 'V',
      resolved: { state: 'solved', value },
      derivation: `node potential: V(${node}) relative to ${netlist.referenceNodeId}`
    };
  }

  if (request.kind === 'node-to-node-voltage' || request.kind === 'voltage-drop') {
    const measurementType = request.kind === 'voltage-drop' ? 'voltage_drop' : 'voltage';
    const from = nodeOf(request.fromTerminalId);
    const to = nodeOf(request.toTerminalId);
    if (!from || !to) {
      return unavailableOutcome(
        measurementType,
        'V',
        'both terminals must be part of this model to measure a difference',
        'request rejected: unknown terminal'
      );
    }
    const fromAbsolute = absoluteVoltage(from);
    const toAbsolute = absoluteVoltage(to);
    if (fromAbsolute !== null && toAbsolute !== null) {
      return {
        measurementType,
        unit: 'V',
        resolved: { state: 'solved', value: fromAbsolute - toAbsolute },
        derivation: `node difference: V(${from}) - V(${to})`
      };
    }
    const fromIsland = solution.islandLocalReference[from];
    const toIsland = solution.islandLocalReference[to];
    if (fromIsland && fromIsland === toIsland) {
      const difference =
        (solution.islandRelativeVoltage[from] ?? 0) - (solution.islandRelativeVoltage[to] ?? 0);
      return {
        measurementType,
        unit: 'V',
        resolved: { state: 'solved', value: difference },
        derivation: `island-relative difference within the island referenced to ${fromIsland}`
      };
    }
    return unavailableOutcome(
      measurementType,
      'V',
      'the two points do not share a defined potential reference',
      'indeterminate reference: the two nodes are in different unreferenced components'
    );
  }

  if (request.kind === 'branch-current') {
    const branchId = request.branchId;
    if (!branchId) {
      return unavailableOutcome(
        'current',
        'A',
        'a current requires a named branch; a terminal pair is not sufficient',
        'request rejected: no branch named'
      );
    }
    const element = netlist.elements.find(
      (candidate) =>
        candidate.elementId === branchId ||
        candidate.templateOrigin === branchId ||
        candidate.elementId === `E:${branchId}:conductor`
    );
    if (!element) {
      return unavailableOutcome(
        'current',
        'A',
        `branch ${branchId} is not present in this model`,
        'request rejected: unknown branch'
      );
    }
    const current = solution.elementCurrent[element.elementId];
    if (current === undefined) {
      return unavailableOutcome(
        'current',
        'A',
        `branch ${element.elementId} carries no resolvable current`,
        'no element law available for this branch'
      );
    }
    const law =
      element.kind === 'ideal-voltage-source'
        ? 'mna-source-unknown'
        : `ohm-element (R = ${element.resistanceOhm ?? 0} ohm)`;
    return {
      measurementType: 'current',
      unit: 'A',
      resolved: { state: 'solved', value: current },
      derivation: `branch ${element.elementId} current from ${element.fromNode} to ${element.toNode} by ${law}`
    };
  }

  if (request.kind === 'power') {
    const branchId = request.branchId;
    if (!branchId) {
      return unavailableOutcome(
        'power',
        'W',
        'a power measurement requires a named branch',
        'request rejected: no branch named'
      );
    }
    const element = netlist.elements.find(
      (candidate) => candidate.elementId === branchId || candidate.templateOrigin === branchId
    );
    if (!element) {
      return unavailableOutcome(
        'power',
        'W',
        `branch ${branchId} is not present in this model`,
        'request rejected: unknown branch'
      );
    }
    const current = solution.elementCurrent[element.elementId];
    if (current === undefined) {
      return unavailableOutcome(
        'power',
        'W',
        `branch ${element.elementId} carries no resolvable current`,
        'no element law available for this branch'
      );
    }
    if (element.resistanceOhm === null || element.resistanceOhm <= 0) {
      return unavailableOutcome(
        'power',
        'W',
        `branch ${element.elementId} has no resistance, so dissipated power is undefined`,
        'an ideal source dissipates no power'
      );
    }
    return {
      measurementType: 'power',
      unit: 'W',
      resolved: { state: 'solved', value: current * current * element.resistanceOhm },
      derivation: `dissipated power in ${element.elementId} by I squared R`
    };
  }

  if (request.kind === 'continuity') {
    const from = nodeOf(request.fromTerminalId);
    const to = nodeOf(request.toTerminalId);
    if (!from || !to) {
      return unavailableOutcome(
        'continuity',
        'boolean',
        'continuity requires two terminals that exist in this model',
        'request rejected: unknown terminal'
      );
    }
    if (from === to) {
      return {
        measurementType: 'continuity',
        unit: 'boolean',
        resolved: {
          state: 'valid-zero',
          value: 0,
          proofBasis: 'the two terminals are merged into a single node by an ideal conductor'
        },
        derivation: 'the two terminals are one node'
      };
    }
    const element = netlist.elements.find(
      (candidate) =>
        (candidate.fromNode === from && candidate.toNode === to) ||
        (candidate.fromNode === to && candidate.toNode === from)
    );
    if (!element || element.resistanceOhm === null) {
      return {
        measurementType: 'continuity',
        unit: 'boolean',
        resolved: {
          state: 'valid-zero',
          value: 0,
          proofBasis: 'no direct conductive element exists between these nodes'
        },
        derivation: 'no direct element connects the two nodes'
      };
    }
    return {
      measurementType: 'continuity',
      unit: 'boolean',
      resolved: {
        state: 'solved',
        value: element.resistanceOhm <= CONTINUITY_RESISTANCE_THRESHOLD_OHM ? 1 : 0
      },
      derivation: `direct element ${element.elementId} with R = ${element.resistanceOhm} ohm against the ${CONTINUITY_RESISTANCE_THRESHOLD_OHM} ohm project threshold`
    };
  }

  if (request.kind === 'command-state') {
    if (relayState === null) {
      return unavailableOutcome(
        'command_state',
        'state',
        'this model declares no relay coupling, so there is no command state',
        'no coupling declared'
      );
    }
    return {
      measurementType: 'command_state',
      unit: 'state',
      resolved: { state: 'solved', value: relayState === 'closed' ? 1 : 0 },
      derivation: `relay contact state resolved from the solved coil voltage: ${relayState}`
    };
  }

  return unavailableOutcome(
    'diagnostic_data',
    'typed-value',
    `measurement kind ${request.kind} is not modelled by the electrical engine`,
    'declared refusal: unsupported measurement kind'
  );
}

/**
 * Reports whether the requested instrument is declared for this lab and can
 * produce the requested quantity. Power is a computed quantity, so it requires
 * an instrument that can measure current or voltage rather than a power range.
 */
export function toolAllowsMeasurement(
  declaredToolIds: readonly string[],
  toolMeasurementTypes: Readonly<Record<string, readonly string[]>>,
  toolId: string,
  measurementType: string
): boolean {
  if (!declaredToolIds.includes(toolId)) return false;
  const supported = toolMeasurementTypes[toolId];
  if (!supported) return false;
  if (supported.includes(measurementType)) return true;
  if (measurementType === 'power') {
    return supported.includes('current') || supported.includes('voltage');
  }
  return false;
}

function precisionFor(unit: Unit) {
  return {
    numericalTolerance: { kind: 'relative' as const, value: 1e-9, basis: 'solver-contract' as const },
    modelPrecision: null,
    instrumentAccuracy: null,
    displayResolution: {
      digits: 3,
      unit,
      basis: 'project-convention' as const,
      referenceId: null
    },
    accuracyUnavailableReason:
      'No applicable source reference supplies an instrument accuracy figure, so none is reported.'
  };
}

interface SolveContext {
  readonly request: SimulationRequest;
  readonly netlist: Netlist;
  readonly solution: MnaSuccess;
  readonly relayState: 'closed' | 'open' | null;
}

function buildQuantity(
  config: ElectricalAdapterConfig,
  measurementRequest: MeasurementRequest,
  context: SolveContext
): Quantity {
  const outcome = deriveMeasurement(
    measurementRequest,
    context.netlist,
    context.solution,
    context.relayState
  );

  const toolAllowed = toolAllowsMeasurement(
    config.declaredToolIds,
    config.toolMeasurementTypes,
    measurementRequest.toolId,
    outcome.measurementType
  );

  // Precedence: an engine-level refusal is more specific than an instrument
  // capability refusal, so it is reported as-is. The instrument check governs
  // quantities the engine could actually have produced.
  const resolved: ResolvedValue =
    outcome.resolved.state === 'unavailable' || !toolAllowed
      ? outcome.resolved.state === 'unavailable'
        ? outcome.resolved
        : {
            state: 'unavailable',
            reason: `the selected instrument ${measurementRequest.toolId} is not declared for this quantity in this lab`
          }
      : outcome.resolved;

  return {
    measurementId: measurementRequest.measurementId,
    measurementType: outcome.measurementType as Quantity['measurementType'],
    unit: outcome.unit as Quantity['unit'],
    resolved,
    sourceRole: 'simulation-derived',
    conditionClass: 'operating-condition',
    validity: {
      conditionClass: 'operating-condition',
      notes:
        'Simulated operating condition. Not a test-condition measurement, and not comparable with a fixed-current reference limit.'
    },
    precision: precisionFor(outcome.unit as Unit),
    provenance: {
      evidenceRole: 'project_authored_training_model',
      modelId: config.manifest.modelId,
      modelVersion: config.manifest.modelVersion,
      templateId: config.templateId,
      templateVersion: config.templateVersion,
      solverVersion: ELECTRICAL_SOLVER_VERSION,
      engine: config.engineLabel ?? 'mna',
      deterministic: true
    },
    modelVersion: config.manifest.modelVersion
  };
}

function solveRequest(
  config: ElectricalAdapterConfig,
  request: SimulationRequest
): SimulationResult {
  const provenance = {
    manifestId: config.manifest.manifestId,
    modelId: config.manifest.modelId,
    modelVersion: config.manifest.modelVersion,
    templateId: config.templateId,
    templateVersion: config.templateVersion,
    solverVersion: ELECTRICAL_SOLVER_VERSION,
    engine: config.engineLabel ?? 'mna',
    deterministic: true as const
  };

  const faults = resolveFaults(config.template, request.faultScenarioIds);
  if (faults.refusal) {
    return { ok: false, requestId: request.requestId, failure: faults.refusal, provenance };
  }

  const core = solveWithRelayCoupling({
    template: config.template,
    modelRef: config.modelRef,
    operatingStateId: request.operatingStateId,
    removedElementIds: faults.removedElementIds,
    relayCouplings: config.relayCouplings
  });
  if (!core.ok) {
    return { ok: false, requestId: request.requestId, failure: core.failure, provenance };
  }

  const context: SolveContext = {
    request,
    netlist: core.netlist,
    solution: core.solution,
    relayState: core.relay?.state ?? null
  };

  const quantities = request.measurementRequests.map((measurementRequest) =>
    buildQuantity(config, measurementRequest, context)
  );

  return {
    ok: true,
    requestId: request.requestId,
    quantities,
    residuals: {
      infinityNorm: core.solution.residuals.infinityNorm,
      iterations: core.solution.residuals.iterations,
      tolerance: core.solution.residuals.tolerance
    },
    excludedElements: core.netlist.excludedElements.map((excluded) => ({
      elementId: excluded.elementId,
      physicalContinuity: excluded.physicalContinuity,
      dcModelApplicability: excluded.dcModelApplicability,
      requiredDomainAdapter: excluded.requiredDomainAdapter,
      exclusionReason: excluded.exclusionReason
    })),
    warnings: core.netlist.warnings,
    provenance
  };
}

/** Creates the electrical domain adapter. Performs no I/O and no routing. */
export function createElectricalAdapter(config: ElectricalAdapterConfig): DomainAdapter {
  return {
    adapterId: ELECTRICAL_ADAPTER_ID,
    domainId: ELECTRICAL_DOMAIN_ID,
    capability: config.capability,
    manifest: config.manifest,
    solve: (request) => solveRequest(config, request),
    listOperatingStates: () => config.operatingStates,
    listFaultScenarios: () => config.faultScenarios,
    listRelayCouplings: () => config.relayCouplings
  };
}

export { solveRequest as solveElectricalRequest };

/** Outcome of the relay contact-state resolution. */
export interface RelayResolution {
  readonly state: 'closed' | 'open';
  readonly basis:
    | 'coil-voltage-above-pickup'
    | 'coil-voltage-below-hold'
    | 'hysteresis-retain'
    | 'coil-element-absent';
  readonly coilVoltageV: number | null;
  readonly iterations: number;
}

interface CoreSolveOutcome {
  readonly ok: true;
  readonly netlist: Netlist;
  readonly solution: MnaSuccess;
  readonly relay: RelayResolution | null;
}

interface CoreSolveFailure {
  readonly ok: false;
  readonly failure: FailureDetail;
}

interface CoreSolveOptions {
  readonly template: unknown;
  readonly modelRef: string;
  readonly operatingStateId: string;
  readonly removedElementIds: readonly string[];
  readonly relayCouplings: readonly RelayCoupling[];
}

/**
 * Resolves the relay contact state from the solved coil voltage using a bounded
 * fixed point. The contact state is an OUTPUT of the solve; it is never taken
 * from the operating-state flag. Non-convergence is reported, never guessed.
 */
export function solveWithRelayCoupling(
  options: CoreSolveOptions
): CoreSolveOutcome | CoreSolveFailure {
  const coupling = options.relayCouplings[0];
  if (!coupling) {
    const translated = translateTemplate(options.template, {
      modelRef: options.modelRef,
      operatingStateId: options.operatingStateId,
      removedElementIds: options.removedElementIds
    });
    if (!translated.ok) return { ok: false, failure: translationFailureToDetail(translated) };
    const solved = solveMna(translated.netlist);
    if (!solved.ok) return { ok: false, failure: mnaFailureToDetail(solved) };
    return { ok: true, netlist: translated.netlist, solution: solved, relay: null };
  }

  let state: 'closed' | 'open' = 'open';
  let iterations = 0;

  for (let attempt = 0; attempt < RELAY_MAX_ITERATIONS; attempt += 1) {
    iterations = attempt + 1;
    const translated = translateTemplate(options.template, {
      modelRef: options.modelRef,
      operatingStateId: options.operatingStateId,
      removedElementIds: options.removedElementIds,
      forcedOpenElementIds: state === 'open' ? [coupling.contactElementId] : [],
      forcedClosedElementIds: state === 'closed' ? [coupling.contactElementId] : []
    });
    if (!translated.ok) return { ok: false, failure: translationFailureToDetail(translated) };
    const netlist = translated.netlist;
    const solved = solveMna(netlist);
    if (!solved.ok) return { ok: false, failure: mnaFailureToDetail(solved) };

    const coil = netlist.elements.find(
      (element) => element.templateOrigin === coupling.coilElementId
    );
    if (!coil) {
      // The coil element is absent, so the contact cannot be energised. A
      // normally-open contact therefore stays electrically OPEN. The basis is
      // recorded rather than inventing a coil voltage.
      return {
        ok: true,
        netlist,
        solution: solved,
        relay: {
          state: 'open',
          basis: 'coil-element-absent',
          coilVoltageV: null,
          iterations
        }
      };
    }

    const controlVoltage = solved.nodeVoltageAbsolute[coil.fromNode];
    const returnVoltage = solved.nodeVoltageAbsolute[coil.toNode];
    if (controlVoltage === undefined || returnVoltage === undefined) {
      return {
        ok: false,
        failure: {
          code: 'RELAY_STATE_UNRESOLVED',
          axis: 'numerical',
          stage: 'solve',
          message:
            'the coil voltage is indeterminate, so the contact state cannot be resolved and no value is returned',
          residuals: null,
          detail: { couplingId: coupling.couplingId, coilElementId: coupling.coilElementId }
        }
      };
    }

    const coilVoltage = Math.abs(controlVoltage - returnVoltage);
    let decided: 'closed' | 'open';
    let basis: RelayResolution['basis'];
    if (coilVoltage >= coupling.pickupVoltageV) {
      decided = 'closed';
      basis = 'coil-voltage-above-pickup';
    } else if (coilVoltage <= coupling.holdVoltageV) {
      decided = 'open';
      basis = 'coil-voltage-below-hold';
    } else {
      decided = state;
      basis = 'hysteresis-retain';
    }

    if (decided === state) {
      return {
        ok: true,
        netlist,
        solution: solved,
        relay: { state, basis, coilVoltageV: coilVoltage, iterations }
      };
    }
    state = decided;
  }

  return {
    ok: false,
    failure: {
      code: 'RELAY_STATE_UNRESOLVED',
      axis: 'numerical',
      stage: 'solve',
      message: 'the relay coupling did not converge within the permitted iterations',
      residuals: null,
      detail: { couplingId: coupling.couplingId, maxIterations: RELAY_MAX_ITERATIONS }
    }
  };
}
