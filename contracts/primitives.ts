/**
 * Shared engineering and diagnostic primitives.
 *
 * These types carry engineering values, their provenance, and their validity
 * conditions. They intentionally contain no numerical behaviour: a value and
 * its visual representation are independent concerns, and a graphical control
 * must never determine engineering truth.
 *
 * Authority boundaries preserved from the canonical LMF contracts
 * (data/lmf/measurement-contract.json, engineering-model-adapters.json):
 * no primitive in this file may express a correct answer, a score, assessment
 * eligibility, publication approval, or a diagnostic conclusion.
 */

/** Measurement type identifiers. Mirrors data/lmf/measurement-contract.json. */
export type QuantityType =
  | 'voltage'
  | 'voltage_drop'
  | 'current'
  | 'resistance'
  | 'continuity'
  | 'frequency'
  | 'duty_cycle'
  | 'waveform'
  | 'network_voltage'
  | 'bus_resistance'
  | 'network_activity'
  | 'pressure'
  | 'vacuum'
  | 'compression_pressure'
  | 'leakdown_percent'
  | 'temperature'
  | 'rpm'
  | 'torque'
  | 'speed'
  | 'angle'
  | 'distance'
  | 'position'
  | 'command_state'
  | 'diagnostic_data'
  /**
   * Engine-level extension. `src/engineering/contracts.js` already supports
   * power, but the LMF measurement contract does not list it, so it is declared
   * here as an explicit superset rather than silently accepted.
   */
  | 'power';

/** Canonical units, including the placeholder units used by the LMF contract. */
export type Unit =
  | 'V'
  | 'A'
  | 'ohm'
  | 'boolean'
  | 'Hz'
  | '%'
  | 'series'
  | 'pressure-unit'
  | 'temperature-unit'
  | 'rpm'
  | 'torque-unit'
  | 'speed-unit'
  | 'degree'
  | 'length-unit'
  | 'position-unit'
  | 'state'
  | 'typed-value'
  /** Engine-level extension paired with the `power` quantity type. */
  | 'W';

/**
 * Where a value came from. Mirrors data/lmf/measurement-contract.json sourceRoles.
 * A measurement record must declare exactly one of these.
 */
export type SourceRole =
  | 'student-entered'
  | 'simulation-derived'
  | 'engineering-model-derived'
  | 'authoritative-specification'
  | 'external-measurement';

/**
 * Whether a quantity reproduces a source-declared test condition exactly, or
 * describes simulated operating behaviour. A fixed-current test limit may only
 * be applied to a `test-condition` quantity.
 */
export type ConditionClass = 'test-condition' | 'operating-condition';

/** Domain identity for the coordinated solver set. */
export type DomainId =
  | 'electrical'
  | 'mechanical'
  | 'hydraulic'
  | 'thermal'
  | 'powertrain'
  | 'network-control'
  | 'vehicle-dynamics'
  | 'integrated-diagnostics';

/** Model lifecycle status. A `planned` entry is an architectural reservation only. */
export type ModelStatus = 'planned' | 'in-development' | 'validated' | 'deprecated';

/** Origin of a model or artifact, expressed without implying authority. */
export type EvidenceRole =
  | 'project_authored_training_model'
  | 'authoritative_specification'
  | 'measured_value'
  | 'model_prediction';

/** Three independent failure axes. See FailureStage and FailureCode. */
export type FailureAxis = 'execution' | 'numerical' | 'physical';

/** Where a failure occurred. Never merge execution failures into numerical ones. */
export type FailureStage =
  | 'execution'
  | 'request'
  | 'assembly'
  | 'factorization'
  | 'solve'
  | 'validation';

/**
 * Failure codes. Mutually exclusive across the three axes:
 * execution (the engine did not produce a solution),
 * numerical (the engine ran; the system has no valid solution),
 * physical (the quantity is genuinely undefined for this circuit).
 */
export type FailureCode =
  // execution
  | 'WORKER_UNAVAILABLE'
  | 'WORKER_INIT_FAILED'
  | 'WORKER_TIMEOUT'
  | 'WORKER_CANCELLED'
  | 'RESOURCE_LIMIT'
  | 'REQUEST_INVALID'
  // numerical
  | 'MATRIX_ASSEMBLY_FAILED'
  | 'NO_REFERENCE_NODE'
  | 'MULTIPLE_REFERENCE_NODES'
  | 'SINGULAR_MATRIX'
  | 'UNDERDETERMINED_SYSTEM'
  | 'RESIDUAL_EXCEEDED'
  | 'NONFINITE_RESULT'
  | 'RELAY_STATE_UNRESOLVED'
  // physical / definitional
  | 'INDETERMINATE_REFERENCE'
  | 'ISOLATED_SUBNETWORK'
  | 'FLOATING_NODE'
  | 'OPEN_CIRCUIT'
  | 'UNMEASURABLE_QUANTITY'
  | 'TOOL_CAPABILITY'
  | 'ROUTING_REQUIRED'
  | 'TOPOLOGY_UNSUPPORTED'
  | 'INVALID_TEMPLATE'
  | 'CROSS_DOMAIN_PATH';

/** Failure detail. `residuals` is null wherever no valid solution was produced. */
export interface FailureDetail {
  readonly code: FailureCode;
  readonly axis: FailureAxis;
  readonly stage: FailureStage;
  /** Human-readable reason. Must never restate an unavailable value as zero. */
  readonly message: string;
  /**
   * Present only when stage === 'validation' and a numeric candidate solution
   * exists. Never synthesised to satisfy a schema.
   */
  readonly residuals: ResidualReport | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface ResidualReport {
  readonly infinityNorm: number;
  readonly iterations: number;
  readonly tolerance: number;
  readonly toleranceKind: 'relative' | 'absolute';
}
