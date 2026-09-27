(function () {
"use strict";

const VALUE_ROLES = Object.freeze([
  "declared_system_value",
  "generic_training_example",
  "calculated_value",
  "authoritative_specification",
  "measured_value"
]);

const QUANTITY_TYPES = Object.freeze([
  "voltage",
  "current",
  "resistance",
  "power",
  "energy",
  "capacity",
  "frequency",
  "duty_cycle",
  "temperature",
  "length",
  "area",
  "resistivity",
  "voltage_drop",
  "power_loss",
  "normalized_input",
  "duration"
]);

const UNITS_BY_QUANTITY = Object.freeze({
  voltage: ["V"],
  current: ["A", "mA"],
  resistance: ["ohm", "mohm"],
  power: ["W", "kW"],
  energy: ["Wh", "kWh", "J"],
  capacity: ["Ah", "mAh"],
  frequency: ["Hz", "kHz"],
  duty_cycle: ["percent"],
  temperature: ["degC"],
  length: ["m", "mm"],
  area: ["m2", "mm2"],
  resistivity: ["ohm_m"],
  voltage_drop: ["V"],
  power_loss: ["W"],
  normalized_input: ["percent"],
  duration: ["s", "min"]
});

const TOLERANCE_TYPES = Object.freeze(["percent", "absolute"]);

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function validateEngineeringQuantity(quantity) {
  const errors = [];
  if (!quantity || typeof quantity !== "object") return ["engineering quantity must be an object"];

  if (!QUANTITY_TYPES.includes(quantity.quantityType)) {
    errors.push("engineering quantity has unsupported quantityType");
  }

  if (!VALUE_ROLES.includes(quantity.valueRole)) {
    errors.push("engineering quantity has unsupported valueRole");
  }

  const allowedUnits = UNITS_BY_QUANTITY[quantity.quantityType] || [];
  if (!allowedUnits.includes(quantity.unit)) {
    errors.push(`${quantity.quantityType || "quantity"} has unsupported unit ${quantity.unit || "(missing)"}`);
  }

  const hasValue = isFiniteNumber(quantity.value);
  const hasRange = quantity.range && typeof quantity.range === "object";
  if (hasValue === Boolean(hasRange)) {
    errors.push("engineering quantity must declare exactly one of value or range");
  }

  if (hasRange) {
    const { min, nominal, max } = quantity.range;
    if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
      errors.push("engineering quantity range requires finite min and max");
    } else if (min > max) {
      errors.push("engineering quantity range min cannot exceed max");
    }
    if (nominal !== undefined && !isFiniteNumber(nominal)) {
      errors.push("engineering quantity range nominal must be finite when provided");
    }
    if (isFiniteNumber(nominal) && isFiniteNumber(min) && isFiniteNumber(max) && (nominal < min || nominal > max)) {
      errors.push("engineering quantity range nominal must fall within min and max");
    }
  }

  if (quantity.tolerance !== undefined) {
    const tolerance = quantity.tolerance;
    if (!tolerance || typeof tolerance !== "object" || !TOLERANCE_TYPES.includes(tolerance.type)) {
      errors.push("engineering quantity tolerance is invalid");
    } else if (!isFiniteNumber(tolerance.value) || tolerance.value < 0) {
      errors.push("engineering quantity tolerance requires a non-negative finite value");
    } else if (tolerance.type === "percent" && tolerance.value > 100) {
      errors.push("engineering quantity percent tolerance cannot exceed 100");
    }
  }

  if (quantity.valueRole === "calculated_value") {
    if (!quantity.calculation || typeof quantity.calculation !== "object") {
      errors.push("calculated_value requires calculation provenance");
    } else {
      if (!quantity.calculation.formula) errors.push("calculated_value requires calculation.formula");
      if (!Array.isArray(quantity.calculation.inputs) || quantity.calculation.inputs.length === 0) {
        errors.push("calculated_value requires calculation.inputs");
      }
    }
  }

  if (quantity.valueRole === "authoritative_specification") {
    if (!quantity.source || typeof quantity.source !== "object" || !quantity.source.id) {
      errors.push("authoritative_specification requires source.id");
    } else if (!quantity.source.locator || typeof quantity.source.locator !== "string") {
      errors.push("authoritative_specification requires source.locator");
    }
  }

  return errors;
}

const api = {
  VALUE_ROLES,
  QUANTITY_TYPES,
  UNITS_BY_QUANTITY,
  TOLERANCE_TYPES,
  validateEngineeringQuantity
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringContracts = api;
})();