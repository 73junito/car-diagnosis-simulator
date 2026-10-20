/**
 * Quantity, provenance, precision and validity contracts.
 *
 * Four precision concepts are kept strictly separate:
 *   1. numericalTolerance  - solver acceptance threshold (not a physical claim)
 *   2. modelPrecision      - declared precision of project-authored model inputs
 *   3. instrumentAccuracy  - measurement uncertainty of an instrument, and only
 *                            when an applicable source reference exists
 *   4. displayResolution   - how many digits the student sees
 *
 * Display rounding must never alter the value used for comparison, and solver
 * tolerance must never be presented to students as measurement uncertainty.
 */

import type { ConditionClass, EvidenceRole, FailureDetail, QuantityType, SourceRole, Unit } from './primitives';

/** Application context of a reference or measurement. */
export interface ApplicabilityContext {
  readonly system?: string;
  readonly systemVoltage?: number;
  readonly testMethod?: string;
  readonly wiringConfiguration?: string;
  readonly conductor?: string;
  readonly starterFamily?: string;
  readonly starterFamilies?: readonly string[];
}

/** Basis of a value. `authoritative-specification` requires a locator. */
export interface Provenance {
  readonly evidenceRole: EvidenceRole;
  /** Model identity and version. Required for every model-derived quantity. */
  readonly modelId?: string;
  readonly modelVersion?: string;
  /** Template identity, when the model is derived from a circuit template. */
  readonly templateId?: string;
  readonly templateVersion?: string;
  /** Solver identity. Absent for values that were not numerically solved. */
  readonly solverVersion?: string;
  readonly engine?: string;
  readonly computedAt?: string;
  readonly deterministic?: boolean;
  /** Authoritative source identity and locator. */
  readonly sourceId?: string;
  readonly sourceLocator?: string;
  readonly applicability?: ApplicabilityContext;
}

/** Declared validity window for a value or model. */
export interface ValidityCondition {
  readonly conditionClass: ConditionClass;
  /** Required when conditionClass is 'test-condition'. */
  readonly testCurrentA?: number;
  readonly testMethod?: string;
  readonly referenceId?: string;
  readonly notes?: string;
}

/**
 * Uncertainty is optional and must never be fabricated. When no applicable
 * source reference supplies an accuracy figure, `instrumentAccuracy` is null
 * and the reason must be stated rather than substituted with a guess.
 */
export interface QuantityPrecision {
  readonly numericalTolerance: {
    readonly kind: 'relative' | 'absolute';
    readonly value: number;
    readonly basis: 'solver-contract';
  };
  readonly modelPrecision: {
    readonly parameterId: string;
    readonly declaredDigits: number;
    readonly basis: 'project-authored-model';
  } | null;
  readonly instrumentAccuracy: {
    readonly kind: 'percent_of_reading' | 'percent_of_range' | 'absolute' | 'digits';
    readonly value: number;
    readonly basis: 'authoritative-specification';
    readonly referenceId: string;
    readonly applicabilityMatched: boolean;
  } | null;
  readonly displayResolution: {
    readonly digits: number;
    readonly unit: Unit;
    readonly basis: 'authoritative-specification' | 'project-convention';
    readonly referenceId: string | null;
  };
  /** Present only when instrumentAccuracy is null, explaining why. */
  readonly accuracyUnavailableReason?: string;
}

/**
 * A resolved engineering value. The discriminant makes the four states
 * structurally distinct: a valid zero, an indeterminate value, an unsupported
 * request, and a failure can never be confused.
 */
export type ResolvedValue =
  | { readonly state: 'solved'; readonly value: number }
  | { readonly state: 'valid-zero'; readonly value: 0; readonly proofBasis: string }
  | { readonly state: 'unavailable'; readonly reason: string }
  | { readonly state: 'failed'; readonly failure: FailureDetail };

/** A quantity as presented to a student or recorded as evidence. */
export interface Quantity {
  readonly measurementId: string;
  readonly measurementType: QuantityType;
  readonly unit: Unit;
  readonly resolved: ResolvedValue;
  readonly sourceRole: SourceRole;
  readonly conditionClass: ConditionClass;
  readonly validity: ValidityCondition;
  readonly precision: QuantityPrecision;
  readonly provenance: Provenance;
  /** Test point or terminal the quantity is bound to, when applicable. */
  readonly testPointId?: string;
  readonly terminalId?: string;
  /** Model version the value is valid for. Present on every model-derived value. */
  readonly modelVersion?: string;
}

/** Formats a quantity for display without mutating the underlying value. */
export function formatQuantityDisplay(quantity: Quantity): string {
  if (quantity.resolved.state === 'unavailable') return `unavailable (${quantity.resolved.reason})`;
  if (quantity.resolved.state === 'failed') return `unavailable (${quantity.resolved.failure.code})`;
  const digits = quantity.precision.displayResolution.digits;
  return `${quantity.resolved.value.toFixed(digits)} ${quantity.unit}`;
}
