/**
 * Observed and recorded measurement contracts.
 *
 * Diagnostic Mode consumes recorded vehicle data or, in later authorized
 * stages, an authorized read-only gateway. This file defines the interface
 * only: Gate 2B implements no vehicle communication and no persistence.
 *
 * The evidence layer must retain the difference between a sensor reading, a
 * student-entered observation, a predicted model value and a manufacturer
 * specification. Those four never collapse into one another.
 */

import type { QuantityType, SourceRole } from './primitives';
import type { ApplicabilityContext, Provenance, ValidityCondition } from './quantity';

/** Data-quality flag. An unqualified observation is not equivalent to a clean one. */
export type QualityFlag =
  | 'clean'
  | 'stale'
  | 'interpolated'
  | 'substituted-default'
  | 'out-of-range'
  | 'suspect';

/** Identifier of the origin of an observation. */
export type ObservationOrigin =
  | 'recorded-file'
  | 'scan-tool'
  | 'gateway-read-only'
  | 'student-entry'
  | 'instructor-entry';

/** A single observed vehicle measurement, with its provenance intact. */
export interface ObservedMeasurement {
  readonly observationId: string;
  readonly sessionId: string;
  readonly measurementType: QuantityType;
  readonly unit: string;
  /** Observed value. Null when the source reported no usable value. */
  readonly value: number | null;
  readonly timestampIso: string;
  readonly origin: ObservationOrigin;
  readonly sourceRole: Extract<SourceRole, 'external-measurement' | 'student-entered'>;
  readonly quality: QualityFlag;
  /** Parameter or PID identity as reported by the source, unmodified. */
  readonly sourceParameterId?: string;
  readonly applicability?: ApplicabilityContext;
  readonly validity: ValidityCondition;
  /** Required for every observation, including imported ones. */
  readonly provenance: Provenance;
  /** Populated when quality is not 'clean'. */
  readonly qualityNote?: string;
}

/** A recorded or live session of observations. */
export interface ObservationSession {
  readonly sessionId: string;
  readonly configurationId: string | null;
  readonly configurationVersion: string | null;
  readonly startedAtIso: string;
  readonly endedAtIso: string | null;
  readonly origin: ObservationOrigin;
  readonly observations: readonly ObservedMeasurement[];
  /** Diagnostic trouble codes reported by the source, verbatim. */
  readonly troubleCodes: readonly ReportedTroubleCode[];
  readonly limitations: readonly string[];
}

/** A reported DTC. Codes are reported, never interpreted as a diagnosis here. */
export interface ReportedTroubleCode {
  readonly code: string;
  readonly status: 'stored' | 'pending' | 'permanent' | 'unknown';
  readonly reportedAtIso: string;
  /** Freeze-frame observations, when the source provides them. */
  readonly freezeFrame?: readonly ObservedMeasurement[];
}

/** Import adapter contract for recorded vehicle data. Design-only in Gate 2B. */
export interface ObservationImportAdapter {
  readonly adapterId: string;
  readonly supportedFormats: readonly ('csv' | 'json' | 'diagnostic-log')[];
  readonly requiresAuthorization: boolean;
  /** Returns a session, or a declared failure. Never a partially invented session. */
  readonly parse: (raw: string) => ObservationSession | ImportFailure;
}

export interface ImportFailure {
  readonly ok: false;
  readonly reason: string;
  readonly code: 'UNSUPPORTED_FORMAT' | 'MALFORMED_INPUT' | 'MISSING_TIMESTAMPS' | 'EMPTY_INPUT';
}

/**
 * Comparison of a predicted value with an observed value.
 *
 * A difference is reported as a difference. It is never automatically a fault,
 * a pass, a fail, or a diagnosis.
 */
export interface PredictionComparison {
  readonly comparisonId: string;
  readonly measurementType: QuantityType;
  readonly unit: string;
  readonly predicted: {
    readonly value: number;
    readonly modelId: string;
    readonly modelVersion: string;
    readonly validity: ValidityCondition;
  };
  readonly observed: {
    readonly value: number;
    readonly observationId: string;
    readonly quality: QualityFlag;
  };
  readonly difference: number;
  /** Comparable only when quantity type, unit, validity and applicability agree. */
  readonly comparable: boolean;
  readonly notComparableReason?: string;
  /** True when the difference exceeds the declared tolerance of the comparison. */
  readonly exceedsTolerance: boolean;
  readonly tolerance: number;
  readonly toleranceBasis: string;
}
