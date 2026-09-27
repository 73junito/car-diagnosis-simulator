(function () {
"use strict";

const contracts = typeof require === "function" ? require("./contracts") : window.TorqueMindEngineeringContracts;
const profiles = typeof require === "function" ? require("./profiles") : window.TorqueMindEngineeringProfiles;
const calculator = typeof require === "function" ? require("./calculator") : window.TorqueMindEngineeringCalculator;
const specifications = typeof require === "function" ? require("./specifications") : window.TorqueMindEngineeringSpecifications;
const measurements = typeof require === "function" ? require("./measurements") : window.TorqueMindEngineeringMeasurements;
const comparisons = typeof require === "function" ? require("./comparisons") : window.TorqueMindEngineeringComparisons;

const api = { contracts, profiles, calculator, specifications, measurements, comparisons };

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineering = api;
})();