(function () {
"use strict";

const POWERTRAIN_LABELS = Object.freeze({
  "conventional-12v": "Conventional automotive",
  hybrid: "Hybrid",
  "plug-in-hybrid": "Plug-in hybrid",
  "battery-electric": "Battery electric",
  "fuel-cell": "Fuel cell",
  "electrified-training": "Electrified vehicle training",
  other: "Other"
});

function classifyVoltageDomain(system) {
  if (!system || !Number.isFinite(system.nominalVoltage) || system.nominalVoltage <= 0) {
    throw new Error("Voltage system requires a positive nominalVoltage.");
  }
  if (system.systemType === "traction") return "traction";
  if (system.nominalVoltage === 12) return "lv-12";
  if (system.nominalVoltage === 24) return "lv-24";
  if (system.nominalVoltage === 48) return "lv-48";
  return "declared-voltage";
}

function formatVoltageSystem(system) {
  return system.displayLabel || `${system.nominalVoltage} V nominal`;
}

function describeVoltageArchitecture(circuit) {
  return (circuit.voltageSystems || []).map((system) => ({
    id: system.id,
    systemType: system.systemType,
    nominalVoltage: system.nominalVoltage,
    label: formatVoltageSystem(system),
    domainClass: classifyVoltageDomain(system),
    powertrainLabel: POWERTRAIN_LABELS[circuit.powertrainType] || circuit.powertrainType
  }));
}

const api = { POWERTRAIN_LABELS, classifyVoltageDomain, formatVoltageSystem, describeVoltageArchitecture };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindVoltageDomains = api;
})();
