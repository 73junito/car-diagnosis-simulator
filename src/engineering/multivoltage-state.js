"use strict";

(function initMultiVoltageEngineeringState(globalScope) {
  function calculateMultiVoltageEngineeringState(options) {
    const {
      calculator,
      domain,
      enteredCurrentValue = null,
      domainActive = false,
      faultType = null
    } = options || {};

    if (!calculator || typeof calculator.calculatePower !== "function") {
      throw new Error("Multivoltage engineering calculator is required.");
    }
    if (!domain || !domain.id || !Number.isFinite(domain.nominalVoltage)) {
      throw new Error("Declared voltage domain is required.");
    }

    const hasCurrent = Number.isFinite(enteredCurrentValue) && enteredCurrentValue > 0;
    const power = hasCurrent
      ? calculator.calculatePower({ voltage: domain.nominalVoltage, current: enteredCurrentValue })
      : null;

    let status = "Current not entered";
    let statusClass = "";
    let comparison = "Declared-domain baseline active; no fault-derived numeric comparison is active.";

    if (faultType === "open_circuit") {
      status = "Selected-domain path open — entered current is not inferred from the fault";
      statusClass = "fault";
      comparison = "Selected-domain path is open; no fault current or power is inferred, so numeric healthy-vs-fault comparison is unavailable.";
    } else if (faultType === "high_resistance") {
      status = "Selected-domain path degraded — no fault current or power inferred";
      statusClass = "fault";
      comparison = "Selected-domain path is degraded; no fault current or power is inferred, so numeric comparison is unavailable.";
    } else if (!domainActive) {
      status = hasCurrent
        ? "Domain inactive in this state — entered current is calculation input only"
        : "Domain inactive; current not entered";
      statusClass = "inactive";
      comparison = "Selected domain is inactive in this operating state; entered current remains calculation input only and is not treated as a fault measurement.";
    } else if (hasCurrent) {
      status = "Calculated from declared voltage and entered current";
      comparison = "Declared-domain calculation uses entered current input only; no fault-derived numeric comparison is active.";
    }

    const voltageBoundary = domain.id === "TR400"
      ? "The 400 V value belongs only to this project-authored training example."
      : "The 12 V value is the declared low-voltage architecture for this training template.";
    const calculation = hasCurrent
      ? "P = " + domain.nominalVoltage + " V × entered " + Number(enteredCurrentValue.toFixed(2)) + " A = " + power.value.toFixed(2) + " W."
      : "Enter a positive current to calculate power.";
    const faultText = faultType
      ? " The injected fault does not create a measured current, voltage, power, converter-efficiency, or motor-output value."
      : "";

    return {
      domain,
      hasCurrent,
      enteredCurrentValue: hasCurrent ? enteredCurrentValue : null,
      power,
      domainActive,
      faultType,
      status,
      statusClass,
      comparison,
      boundary: domain.id === "TR400"
        ? "400 V is a declared training example, not a universal traction voltage"
        : "Declared 12 V training domain",
      formula: voltageBoundary + " " + calculation +
        " This calculation does not imply DC/DC conversion ratio, efficiency, inverter switching behavior, traction-motor torque, or vehicle-specific operating limits." +
        faultText
    };
  }

  const api = Object.freeze({ calculateMultiVoltageEngineeringState });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.TorqueMindMultiVoltageEngineeringState = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
