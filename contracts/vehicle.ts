/**
 * Vehicle configuration and capability contracts.
 *
 * The platform supports gasoline, diesel, hybrid and battery-electric vehicles
 * through versioned, capability-specific models. A configuration declares what
 * the vehicle is; it does not assert that a model for it exists.
 *
 * High-voltage safety is explicit: any voltage domain above the low-voltage
 * class carries a training-only notice and cannot authorize physical work.
 */

import type { DomainId, ModelStatus } from './primitives';

/** Powertrain family. Mirrors the existing circuit POWERTRAIN_TYPES vocabulary. */
export type PowertrainKind =
  | 'gasoline'
  | 'diesel'
  | 'hybrid'
  | 'plug-in-hybrid'
  | 'battery-electric'
  | 'fuel-cell'
  | 'other';

/** Voltage system class, aligned with src/circuits/voltage-domains.js. */
export type VoltageClass = 'lv-12' | 'lv-24' | 'lv-48' | 'traction' | 'declared-voltage';

/** A declared voltage system within a vehicle. */
export interface VoltageDomainDeclaration {
  readonly id: string;
  readonly systemType: 'low-voltage' | 'traction' | 'starter-generator' | 'accessory' | 'other';
  readonly nominalVoltage: number;
  readonly unit: 'V DC';
  readonly displayLabel: string;
  readonly voltageClass: VoltageClass;
  /**
   * True for any domain that is not low-voltage. Training-only domains must
   * never be represented as authorization for physical high-voltage servicing.
   */
  readonly trainingOnly: boolean;
  readonly isolationBoundary: string | null;
}

/** Identifier of an authorized diagnostic interface. Design-only in Gate 2B. */
export interface VehicleInterfaceDeclaration {
  readonly interfaceId: string;
  readonly transport: 'obd-ii' | 'can' | 'lin' | 'j1939' | 'doip' | 'recorded-file';
  /** Gate 2B is read-only by contract; actuation is out of scope. */
  readonly accessMode: 'read-only';
  readonly requiresAuthorization: true;
  readonly capabilitySource: string;
}

/** A versioned vehicle configuration. */
export interface VehicleConfiguration {
  readonly configurationId: string;
  readonly configurationVersion: string;
  readonly status: ModelStatus;
  readonly powertrainKind: PowertrainKind;
  readonly displayName: string;
  readonly voltageDomains: readonly VoltageDomainDeclaration[];
  readonly interfaces: readonly VehicleInterfaceDeclaration[];
  /** Domains for which a validated model exists for this configuration. */
  readonly modelledDomains: readonly DomainId[];
  /** Explicit, disclosed simplifications for this configuration. */
  readonly simplifications: readonly string[];
  readonly safetyNotices: readonly string[];
  /** Generic training configurations must not claim vehicle specificity. */
  readonly vehicleSpecific: boolean;
  readonly provenance: {
    readonly sourceRole: 'project-authored-training-model';
    readonly scoredAssessmentApproved: false;
    readonly authorityRegistry: 'data/compliance/authority-registry.json';
  };
}

/** True when a configuration declares any non-low-voltage domain. */
export function hasHighVoltageDomain(configuration: VehicleConfiguration): boolean {
  return configuration.voltageDomains.some((domain) => domain.voltageClass === 'traction');
}
