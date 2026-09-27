(function () {
"use strict";

const contracts = typeof require === "function" ? require("./contracts") : window.TorqueMindEngineeringContracts;
const profiles = typeof require === "function" ? require("./profiles") : window.TorqueMindEngineeringProfiles;
const calculator = typeof require === "function" ? require("./calculator") : window.TorqueMindEngineeringCalculator;

const api = { contracts, profiles, calculator };

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineering = api;
})();