"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // engine/circuitLabCalculations.js
  var require_circuitLabCalculations = __commonJS({
    "engine/circuitLabCalculations.js"(exports, module) {
      "use strict";
      var MODEL = "ideal-resistive-dc-v1";
      function positive(value, label) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new RangeError(label + " must be a positive finite number");
        return value;
      }
      function finite(value, label) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(label + " must be a finite number");
        return value;
      }
      function result(value, unit) {
        return Object.freeze({ value, unit, model: MODEL, illustrative: true, validatedAgainstManufacturer: false });
      }
      function current({ voltageV, resistanceOhm }) {
        return result(finite(voltageV, "voltageV") / positive(resistanceOhm, "resistanceOhm"), "A");
      }
      function voltage({ currentA, resistanceOhm }) {
        return result(finite(currentA, "currentA") * positive(resistanceOhm, "resistanceOhm"), "V");
      }
      function resistance({ voltageV, currentA }) {
        const i = finite(currentA, "currentA");
        if (i === 0) throw new RangeError("currentA cannot be zero");
        const r = finite(voltageV, "voltageV") / i;
        return result(positive(r, "calculated resistance"), "ohm");
      }
      function power({ voltageV, currentA }) {
        return result(finite(voltageV, "voltageV") * finite(currentA, "currentA"), "W");
      }
      function calculate({ voltageV, resistanceOhm }) {
        const i = current({ voltageV, resistanceOhm });
        return Object.freeze({ model: MODEL, assumptions: ["steady state", "ideal DC source", "constant resistive load"], voltage: result(voltageV, "V"), resistance: result(resistanceOhm, "ohm"), current: i, power: power({ voltageV, currentA: i.value }), assessmentEligible: false });
      }
      function compare({ predicted, measured, unit }) {
        finite(predicted, "predicted");
        if (typeof unit !== "string" || !unit.trim()) throw new TypeError("unit is required");
        if (measured === null || measured === void 0) return Object.freeze({ status: "not_supplied", difference: null, absoluteDifference: null, percentDifference: null, unit, interpretation: "No measurement supplied; no discrepancy can be evaluated", assessmentEligible: false });
        finite(measured, "measured");
        const difference = measured - predicted;
        return Object.freeze({ status: "compared", predicted, measured, difference, absoluteDifference: Math.abs(difference), percentDifference: predicted === 0 ? null : Math.abs(difference) / Math.abs(predicted) * 100, unit, interpretation: "Numerical discrepancy only; technical acceptability needs independent criteria and source applicability", assessmentEligible: false });
      }
      module.exports = { MODEL, current, voltage, resistance, power, calculate, compare };
    }
  });

  // dashboard/student/aut250-lab-assets/src/calculator-entry.js
  var require_calculator_entry = __commonJS({
    "dashboard/student/aut250-lab-assets/src/calculator-entry.js"(exports, module) {
      var { calculate, compare } = require_circuitLabCalculations();
      function parseRequired(raw, name) {
        if (raw.trim() === "") throw new Error(name + " is required");
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(name + " must be a finite number");
        return n;
      }
      function renderCalculation({ voltageText, resistanceText, measuredText }) {
        const voltageV = parseRequired(voltageText, "Voltage");
        const resistanceOhm = parseRequired(resistanceText, "Resistance");
        const estimate = calculate({ voltageV, resistanceOhm });
        const measured = measuredText.trim() === "" ? void 0 : parseRequired(measuredText, "Measured current");
        const comparison = compare({ predicted: estimate.current.value, measured, unit: "A" });
        const fmt = (x) => Number(x).toLocaleString("en-US", { maximumFractionDigits: 6 });
        const rows = [["Predicted current", fmt(estimate.current.value) + " A"], ["Predicted power", fmt(estimate.power.value) + " W"], ["Model", estimate.model], ["Measurement", comparison.status === "not_supplied" ? "Not supplied" : fmt(measured) + " A"], ["Difference (measured \u2212 predicted)", comparison.difference === null ? "Not supplied" : fmt(comparison.difference) + " A"], ["Absolute difference", comparison.absoluteDifference === null ? "Not supplied" : fmt(comparison.absoluteDifference) + " A"], ["Percent magnitude difference", comparison.percentDifference === null ? "Not defined / not supplied" : fmt(comparison.percentDifference) + "%"], ["Technical compliance", "Not determined; no applicable manufacturer criteria supplied"]];
        return rows;
      }
      function mount(doc) {
        const form = doc.getElementById("calculator");
        if (!form) return false;
        const output = doc.getElementById("results"), error = doc.getElementById("error");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          error.hidden = true;
          error.textContent = "";
          try {
            const rows = renderCalculation({ voltageText: doc.getElementById("voltage").value, resistanceText: doc.getElementById("resistance").value, measuredText: doc.getElementById("measured").value });
            const dl = doc.createElement("dl");
            for (const [name, value] of rows) {
              const dt = doc.createElement("dt"), dd = doc.createElement("dd");
              dt.textContent = name;
              dd.textContent = value;
              dl.append(dt, dd);
            }
            output.replaceChildren(dl);
          } catch (err) {
            output.textContent = "Calculation unavailable. Correct the inputs and try again.";
            error.textContent = err.message;
            error.hidden = false;
          }
        });
        return true;
      }
      if (typeof document !== "undefined") mount(document);
      module.exports = { renderCalculation, mount };
    }
  });
  require_calculator_entry();
})();
