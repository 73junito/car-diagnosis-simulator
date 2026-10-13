"use strict";

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(name + " must be a finite number");
  return number;
}

function positive(value, name) {
  const number = finite(value, name);
  if (number <= 0) throw new Error(name + " must be greater than zero");
  return number;
}

const ElectricalMeasurementAdapter = Object.freeze({
  id: "electrical-measurement",
  sourceType: "deterministic-electrical-math",
  async execute(input = {}, context = {}) {
    let normalizedData;

    if (input.operation === "ohms-law") {
      const known = input.known || {};
      const voltage = known.voltage == null ? null : finite(known.voltage, "voltage");
      const current = known.current == null ? null : finite(known.current, "current");
      const resistance = known.resistance == null ? null : positive(known.resistance, "resistance");
      const count = [voltage, current, resistance].filter((value) => value !== null).length;
      if (count !== 2) throw new Error("ohms-law requires exactly two known values");

      if (resistance === null && current === 0) {
        throw new Error("current must be non-zero when solving resistance");
      }
      normalizedData = {
        operation: "ohms-law",
        voltage: voltage ?? current * resistance,
        current: current ?? voltage / resistance,
        resistance: resistance ?? voltage / current
      };
    } else if (input.operation === "voltage-drop-percent") {
      const sourceVoltage = positive(input.sourceVoltage, "sourceVoltage");
      const measuredDrop = finite(input.measuredDrop, "measuredDrop");
      if (measuredDrop < 0) throw new Error("measuredDrop must be zero or greater");
      normalizedData = {
        operation: "voltage-drop-percent",
        sourceVoltage,
        measuredDrop,
        dropPercent: (measuredDrop / sourceVoltage) * 100
      };
    } else if (input.operation === "power") {
      const voltage = finite(input.voltage, "voltage");
      const current = finite(input.current, "current");
      normalizedData = {
        operation: "power",
        voltage,
        current,
        watts: voltage * current
      };
    } else {
      throw new Error("unsupported electrical-measurement operation");
    }

    return {
      retrievedAt: context.retrievedAt || new Date().toISOString(),
      vehicleMatch: "generic",
      canonicalUrl: null,
      cacheStatus: "local",
      normalizedData: {
        ...normalizedData,
        advisory: "Deterministic arithmetic only; compare results to approved service information and technician measurements."
      }
    };
  }
});

module.exports = ElectricalMeasurementAdapter;
