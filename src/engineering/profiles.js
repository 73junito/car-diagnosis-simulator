(function () {
"use strict";

const contracts = typeof require === "function"
  ? require("./contracts")
  : window.TorqueMindEngineeringContracts;

const PROFILE_TYPES = Object.freeze([
  "battery",
  "conductor",
  "fuse",
  "switch",
  "relay",
  "resistive_load",
  "motor",
  "solenoid",
  "sensor",
  "actuator",
  "controller",
  "connector",
  "network_bus",
  "converter",
  "inverter"
]);

const SIGNAL_TYPES = Object.freeze([
  "analog_voltage",
  "resistive",
  "digital",
  "pwm",
  "frequency",
  "can",
  "lin"
]);

const BATTERY_CHEMISTRIES = Object.freeze([
  "lead_acid_flooded",
  "lead_acid_agm",
  "lead_acid_efb",
  "lead_acid_gel",
  "lithium_ion",
  "other"
]);

function validateEngineeringProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== "object") return ["engineering profile must be an object"];
  if (!PROFILE_TYPES.includes(profile.profileType)) errors.push("engineering profile has unsupported profileType");

  if (profile.signalType !== undefined && !SIGNAL_TYPES.includes(profile.signalType)) {
    errors.push("engineering profile has unsupported signalType");
  }

  if (profile.profileType === "battery" && profile.chemistry !== undefined && !BATTERY_CHEMISTRIES.includes(profile.chemistry)) {
    errors.push("battery engineering profile has unsupported chemistry");
  }

  if (!profile.parameters || typeof profile.parameters !== "object" || Array.isArray(profile.parameters)) {
    errors.push("engineering profile requires parameters object");
    return errors;
  }

  for (const [name, quantity] of Object.entries(profile.parameters)) {
    const quantityErrors = contracts.validateEngineeringQuantity(quantity);
    errors.push(...quantityErrors.map((error) => `${name}: ${error}`));
  }

  if (profile.profileType === "conductor") {
    for (const required of ["length", "area"]) {
      if (!profile.parameters[required]) errors.push(`conductor engineering profile requires ${required} parameter`);
    }
  }

  return errors;
}

const api = {
  PROFILE_TYPES,
  SIGNAL_TYPES,
  BATTERY_CHEMISTRIES,
  validateEngineeringProfile
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringProfiles = api;
})();