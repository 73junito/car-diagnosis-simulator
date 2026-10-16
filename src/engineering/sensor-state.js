"use strict";

(function initSensorEngineeringState(globalScope) {
  function calculateSensorSignalState(options) {
    const {
      calculator,
      inputPercent,
      signalRange,
      referenceVoltage,
      operatingState,
      faultBehavior = null,
      shortGroundArtifact = null
    } = options || {};

    if (!calculator || typeof calculator.calculateLinearTransfer !== "function") {
      throw new Error("Sensor engineering calculator is required.");
    }
    if (!signalRange || !Number.isFinite(signalRange.min) || !Number.isFinite(signalRange.max)) {
      throw new Error("Sensor signal range is required.");
    }
    if (!Number.isFinite(referenceVoltage)) {
      throw new Error("Sensor reference voltage is required.");
    }

    const transfer = calculator.calculateLinearTransfer({
      inputPercent,
      outputMin: signalRange.min,
      outputMax: signalRange.max,
      quantityType: "voltage",
      unit: "V"
    });

    if (operatingState !== "active-signal") {
      return {
        transfer,
        observed: null,
        status: "Signal state inactive",
        statusClass: "inactive",
        note: "The transfer relationship remains visible, but controller-observed signal is not evaluated until the active-signal state is selected.",
        artifactBacked: false
      };
    }

    if (!faultBehavior) {
      return {
        transfer,
        observed: transfer.value,
        status: "Healthy training example",
        statusClass: "",
        note: "The controller-observed signal follows the generic linear transfer example.",
        artifactBacked: false
      };
    }

    if (faultBehavior.mode === "controller_signal_forced_ground") {
      let observed = 0;
      let artifactBacked = false;
      if (shortGroundArtifact) {
        if (Math.abs(shortGroundArtifact.baseline - transfer.value) > 1e-9) {
          throw new Error("Sensor artifact baseline does not match the current nominal transfer.");
        }
        observed = shortGroundArtifact.observed;
        artifactBacked = true;
      }
      return {
        transfer,
        observed,
        status: "Signal short-to-ground training fault",
        statusClass: "fault",
        note: faultBehavior.reason + (artifactBacked ? " Validated engineering artifact applied for the 50% nominal training state." : ""),
        artifactBacked
      };
    }

    if (faultBehavior.mode === "controller_signal_forced_reference") {
      return {
        transfer,
        observed: referenceVoltage,
        status: "Signal short-to-reference training fault",
        statusClass: "fault",
        note: faultBehavior.reason,
        artifactBacked: false
      };
    }

    if (faultBehavior.mode === "controller_signal_unavailable") {
      return {
        transfer,
        observed: null,
        status: "Signal path open",
        statusClass: "fault",
        note: faultBehavior.reason,
        artifactBacked: false
      };
    }

    return {
      transfer: null,
      observed: null,
      status: "Sensor output not inferred",
      statusClass: "fault",
      note: faultBehavior.reason || "Sensor output not inferred.",
      artifactBacked: false
    };
  }

  const api = Object.freeze({ calculateSensorSignalState });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.TorqueMindSensorEngineeringState = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
