/**
 * Operating-mode contracts: Engineering, Diagnostic and Integrated.
 *
 * Model reuse rule (the central design constraint):
 * all three modes resolve against the SAME versioned engineering model. The
 * modes differ only in what evidence they add, never in the physics they use.
 *
 *   Engineering  - model-derived quantities only
 *   Diagnostic   - observed quantities only
 *   Integrated   - both, compared, with the two kept structurally distinct
 *
 * A prediction and a measurement are different types in this file. They cannot
 * be interchanged, and neither may be relabelled as the other.
 */

import type { DomainId } from './primitives';
import type { ModelState } from './model';
import type { PredictionComparison, ObservedMeasurement, ObservationSession } from './measurement';
import type { Quantity, ValidityCondition } from './quantity';
import type { SimulationResult } from './engine';

export type OperatingMode = 'engineering' | 'diagnostic' | 'integrated';

/** Declares how each mode resolves the same model. */
export interface ModeReuseContract {
  readonly labId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly engineering: {
    readonly usesModel: true;
    readonly addsObservations: false;
    readonly sourceRole: 'simulation-derived' | 'engineering-model-derived';
  };
  readonly diagnostic: {
    readonly usesModel: false;
    readonly addsObservations: true;
    readonly sourceRole: 'external-measurement' | 'student-entered';
  };
  readonly integrated: {
    readonly usesModel: true;
    readonly addsObservations: true;
    readonly keepsRolesDistinct: true;
  };
  /** Modes may only compare values that satisfy this rule. */
  readonly comparisonRule: {
    readonly requiresMatchingQuantityType: true;
    readonly requiresMatchingUnit: true;
    readonly requiresMatchingValidity: true;
    readonly requiresMatchingApplicability: true;
    readonly onMismatch: 'not-comparable';
  };
}

/** Engineering Mode request: parameters, states, faults, measurements. */
export interface EngineeringModeRequest {
  readonly mode: 'engineering';
  readonly labId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly operatingStateId: string;
  readonly faultScenarioIds: readonly string[];
  /** Manual parameter entry, whitelisted and bounded per model. */
  readonly manualParameters?: Readonly<Record<string, number>>;
  readonly domainIds: readonly DomainId[];
}

export interface EngineeringModeResult {
  readonly mode: 'engineering';
  readonly results: readonly SimulationResult[];
  readonly operatingStates: readonly ModelState[];
  readonly simplifications: readonly string[];
  /** Engineering Mode never contains observed vehicle data. */
  readonly observations: readonly never[];
}

/** Diagnostic Mode request: recorded or authorized live observations. */
export interface DiagnosticModeRequest {
  readonly mode: 'diagnostic';
  readonly labId: string;
  readonly sessionId: string;
  /** An imported session or a declared import failure. */
  readonly session: ObservationSession;
  /** Optional filter by measurement type or source parameter. */
  readonly measurementTypes?: readonly string[];
}

export interface DiagnosticModeResult {
  readonly mode: 'diagnostic';
  readonly observations: readonly ObservedMeasurement[];
  readonly troubleCodesReported: number;
  /** Diagnostic Mode never fabricates a predicted value. */
  readonly predictions: readonly never[];
  readonly limitations: readonly string[];
}

/** Integrated Mode request: coordinated models plus observed evidence. */
export interface IntegratedModeRequest {
  readonly mode: 'integrated';
  readonly labId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly operatingStateId: string;
  readonly faultScenarioIds: readonly string[];
  readonly sessionId: string;
  readonly domainIds: readonly DomainId[];
}

/** Confidence describes evidence quality and model fit only. */
export type ConfidenceBasis =
  | 'insufficient-evidence'
  | 'weak'
  | 'moderate'
  | 'supported'
  | 'strongly-supported';

export interface IntegratedModeResult {
  readonly mode: 'integrated';
  readonly predicted: readonly Quantity[];
  readonly observed: readonly ObservedMeasurement[];
  readonly comparisons: readonly PredictionComparison[];
  readonly hypotheses: readonly DiagnosticHypothesis[];
  readonly verificationPlan: VerificationPlan | null;
  readonly evidence: readonly EvidenceRecord[];
  /**
   * Always explicit. When evidence is insufficient, the platform reports that
   * rather than producing a confident-sounding diagnosis.
   */
  readonly confidence: {
    readonly basis: ConfidenceBasis;
    readonly explanation: string;
  };
}

/** What kind of evidence a record holds. The four roles never collapse. */
export type EvidenceKind =
  | 'model-prediction'
  | 'authoritative-specification'
  | 'observed-measurement'
  | 'student-observation'
  | 'student-reasoning';

export interface EvidenceRecord {
  readonly evidenceId: string;
  readonly kind: EvidenceKind;
  readonly sourceRole:
    | 'simulation-derived'
    | 'engineering-model-derived'
    | 'authoritative-specification'
    | 'external-measurement'
    | 'student-entered';
  /** Model identity for predictions; absent for observations and reasoning. */
  readonly modelId?: string;
  readonly modelVersion?: string;
  readonly validity: ValidityCondition;
  readonly description: string;
  /** Student reasoning text, when kind is 'student-reasoning'. */
  readonly reasoningText?: string;
}

/** A hypothesis with explicit supporting and contrary evidence. */
export interface DiagnosticHypothesis {
  readonly hypothesisId: string;
  readonly statement: string;
  /** Fault classes the hypothesis corresponds to, when known. */
  readonly candidateFaultClassIds: readonly string[];
  readonly supportingEvidenceIds: readonly string[];
  /** Contrary evidence must be listed, not omitted. */
  readonly contraryEvidenceIds: readonly string[];
  readonly status: 'proposed' | 'supported' | 'contradicted' | 'not-discriminated';
  readonly confidence: ConfidenceBasis;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
}

/** The next measurement recommended to discriminate between hypotheses. */
export interface VerificationPlan {
  readonly planId: string;
  readonly steps: readonly VerificationStep[];
  /** True when no step can currently discriminate between hypotheses. */
  readonly inconclusive: boolean;
  readonly inconclusiveReason?: string;
}

export interface VerificationStep {
  readonly stepId: string;
  readonly instruction: string;
  readonly measurementType: string;
  readonly targetId: string;
  /** Hypotheses this step separates. */
  readonly discriminatesBetween: readonly string[];
  readonly expectedIfSupported: readonly string[];
  readonly expectedIfContradicted: readonly string[];
  readonly toolId: string;
}

/** The student reasoning sequence. Free-text steps are not multiple choice. */
export interface StudentReasoningRecord {
  readonly reasoningId: string;
  readonly sessionId: string;
  readonly hypothesisText: string;
  readonly testSelectionText: string;
  readonly measurementObserved: string;
  readonly interpretationText: string;
  readonly diagnosisText: string;
  readonly transferAttemptText: string | null;
  /** Practice evidence only. Never an assessment record. */
  readonly practiceOnly: true;
}

/** Reports whether a lab supports a mode. Unsupported modes fail closed. */
export function modeIsSupported(contract: ModeReuseContract, mode: OperatingMode): boolean {
  if (mode === 'engineering') return contract.engineering.usesModel;
  if (mode === 'diagnostic') return contract.diagnostic.addsObservations;
  return contract.integrated.usesModel && contract.integrated.addsObservations;
}
