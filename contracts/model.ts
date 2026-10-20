/**
 * Model manifest, capability and fault-scenario contracts.
 *
 * A ModelManifest is the versioned declaration of what a model covers. It must
 * state its capability limits explicitly: an unsupported capability is a
 * first-class declaration, not an omission that a caller may guess at.
 *
 * Reuse rule: the canonical lab registry is data/lmf/lab-registry.json. This
 * file introduces no competing registry; it describes models, not labs.
 */

import type { DomainId, ModelStatus, QuantityType } from './primitives';
import type { ApplicabilityContext } from './quantity';

/** Canonical fault classes. Mirrors data/lmf/fault-taxonomy.json. */
export type FaultClassId =
  | 'electrical.open'
  | 'electrical.high-resistance'
  | 'electrical.short-to-ground'
  | 'electrical.short-to-power'
  | 'electrical.short-between-lines'
  | 'mechanical.wear'
  | 'mechanical.leakage'
  | 'mechanical.binding'
  | 'mechanical.misalignment'
  | 'hydraulic.restriction'
  | 'hydraulic.external-leak'
  | 'hydraulic.internal-leak'
  | 'hydraulic.air-ingress'
  | 'hydraulic.pressure-loss'
  | 'thermal.restricted-flow'
  | 'thermal.insufficient-heat-transfer'
  | 'thermal.improper-pressure'
  | 'communications.open-bus'
  | 'communications.short-bus'
  | 'communications.node-offline'
  | 'communications.data-integrity'
  | 'control.sensor-bias'
  | 'control.actuator-response'
  | 'drivetrain.slip'
  | 'drivetrain.engagement'
  | 'calibration.out-of-tolerance';

/** Legacy circuit fault vocabulary mapped by the canonical fault taxonomy. */
export type LegacyFaultType =
  | 'open_circuit'
  | 'high_resistance'
  | 'short_to_ground'
  | 'short_to_power'
  | 'short_between_lines';

/**
 * A fault scenario. Faults are overlays on a model and never mutate the
 * canonical model definition.
 */
export interface FaultScenario {
  readonly scenarioId: string;
  readonly label: string;
  readonly faultClassId: FaultClassId;
  /** Model element the fault targets. */
  readonly targetElementId: string;
  /** Declared magnitude for graded faults such as high resistance. */
  readonly magnitude?: {
    readonly quantityType: QuantityType;
    readonly unit: string;
    readonly value: number;
  };
  /** True when the model intentionally does not infer a numeric result. */
  readonly resultUnavailable?: boolean;
  readonly reason?: string;
  readonly legacyType?: LegacyFaultType;
}

/** A capability a model declares, with its own validation status. */
export interface ModelCapability {
  readonly capabilityId: string;
  readonly domainId: DomainId;
  readonly measurementTypes: readonly QuantityType[];
  readonly status: ModelStatus;
  /** Validation references that must exist before status may advance. */
  readonly validationRefs: readonly string[];
  /** Explicit limits. An absent capability must not be assumed present. */
  readonly limitations: readonly string[];
}

/** Declared applicability of a model. */
export interface ModelApplicability {
  readonly mode: 'generic-training-only' | 'vehicle-specific';
  readonly vehicleSpecific: boolean;
  readonly notice: string;
  readonly context?: ApplicabilityContext;
}

/**
 * The versioned declaration of a model. `unsupported` states are declared here
 * so that a caller receives an explicit refusal rather than a substituted value.
 */
export interface ModelManifest {
  readonly manifestId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly schemaVersion: string;
  readonly status: ModelStatus;
  readonly primaryDomainId: DomainId;
  /** Domains this model couples to. Multi-domain labs declare several. */
  readonly coupledDomainIds: readonly DomainId[];
  readonly applicability: ModelApplicability;
  readonly capabilities: readonly ModelCapability[];
  /** Measurement types the model deliberately refuses to produce. */
  readonly unsupportedMeasurementTypes: readonly QuantityType[];
  /** Disclosed simplifications, surfaced to students. */
  readonly simplifications: readonly string[];
  /** Artifacts the model depends on, by repository-relative path. */
  readonly dependencies: readonly string[];
  readonly provenance: {
    readonly evidenceRole: 'project_authored_training_model';
    readonly authoritativeSpecification: false;
  };
}

/**
 * Resolved operating state of a model. State-dependent elements are declared
 * here; a graphical control or animation flag must never determine engineering
 * truth.
 */
export interface ModelState {
  readonly stateId: string;
  readonly label: string;
  /** Independently actuated elements only. */
  readonly elementStates: readonly IndependentlyActuatedElementState[];
  /** Presentation-only flow hints. The solver must never read these. */
  readonly presentationOnly?: Readonly<Record<string, unknown>>;
}

export interface IndependentlyActuatedElementState {
  readonly elementId: string;
  readonly actuation: 'closed' | 'open';
  readonly basis: 'operator-actuation' | 'operating-state';
}

/**
 * Coil-to-contact coupling. A coupled contact must NOT appear in
 * IndependentlyActuatedElementState: its state is an output of the solve.
 */
export interface RelayCoupling {
  readonly couplingId: string;
  readonly coilElementId: string;
  readonly contactElementId: string;
  readonly coilControlNode: string;
  readonly coilReturnNode: string;
  readonly pickupVoltageV: number;
  readonly holdVoltageV: number;
  readonly model: 'threshold-on-solved-coil-voltage';
  readonly dynamics: 'quasi-static-declared';
  readonly dynamicsNotice: string;
  readonly parameterProvenance: 'project-authored-training-value';
}
