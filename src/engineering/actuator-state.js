"use strict";

(function initActuatorEngineeringState(globalScope) {
  function calculateActuatorEngineeringState(options) {
    const {
      calculator,
      supplyVoltage,
      dutyCyclePercent,
      operatingState,
      faultBehavior = null,
      shortGroundArtifact = null
    } = options || {};

    if (!calculator || typeof calculator.calculatePwmAverage !== "function") {
      throw new Error("Actuator engineering calculator is required.");
    }
    if (!Number.isFinite(supplyVoltage)) {
      throw new Error("Declared actuator supply voltage is required.");
    }
    if (!Number.isFinite(dutyCyclePercent)) {
      throw new Error("Actuator duty-cycle input is required.");
    }

    const ideal = calculator.calculatePwmAverage({
      highVoltage: supplyVoltage,
      dutyCyclePercent
    });

    const commandActive = operatingState === "pwm-low-example" || operatingState === "pwm-high-example";
    let observed = commandActive ? ideal.value : null;
    let status = commandActive ? "Healthy training example" : "PWM command inactive";
    let statusClass = commandActive ? "" : "inactive";
    let power = "Available";
    let ground = "Available";
    let note = commandActive
      ? "The actuator-side command follows the generic PWM command representation."
      : "No active PWM command is shown in this operating state.";
    let artifactBacked = false;

    if (operatingState === "key-off") {
      power = "Inactive";
      ground = "Inactive";
    }

    if (faultBehavior) {
      statusClass = "fault";

      if (faultBehavior.mode === "actuator_command_unavailable") {
        observed = null;
        status = "Actuator-side PWM unavailable";
      }

      if (faultBehavior.mode === "actuator_command_forced_ground") {
        observed = 0;
        status = "PWM short-to-ground training fault";
        if (shortGroundArtifact) {
          if (Math.abs(shortGroundArtifact.baseline - ideal.value) > 1e-9) {
            throw new Error("PWM artifact baseline does not match the current nominal average.");
          }
          observed = shortGroundArtifact.observed;
          artifactBacked = true;
        }
      }

      if (faultBehavior.mode === "actuator_command_forced_power") {
        observed = supplyVoltage;
        status = "PWM short-to-power training fault";
      }

      if (faultBehavior.mode === "actuator_power_unavailable") {
        power = "Unavailable";
        status = "Actuator power unavailable";
      }

      if (faultBehavior.mode === "actuator_ground_unavailable") {
        ground = "Unavailable";
        status = "Actuator ground unavailable";
      }

      if (faultBehavior.mode === "actuator_power_degraded") {
        power = "Degraded";
        status = "Actuator power path degraded";
      }

      if (faultBehavior.mode === "actuator_ground_degraded") {
        ground = "Degraded";
        status = "Actuator ground path degraded";
      }

      note = faultBehavior.reason || note;
      if (artifactBacked) {
        note += " Validated engineering artifact applied for the 30% nominal training state.";
      }
    }

    return {
      ideal,
      observed,
      status,
      statusClass,
      power,
      ground,
      note,
      artifactBacked,
      commandActive
    };
  }

  const api = Object.freeze({ calculateActuatorEngineeringState });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.TorqueMindActuatorEngineeringState = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
