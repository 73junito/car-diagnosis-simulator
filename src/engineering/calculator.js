(function () {
"use strict";

function requireFinite(name, value) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function requirePositive(name, value) {
  requireFinite(name, value);
  if (value <= 0) throw new Error(`${name} must be greater than zero`);
  return value;
}

function calculatedQuantity(quantityType, unit, value, formula, inputs) {
  return {
    quantityType,
    unit,
    valueRole: "calculated_value",
    value,
    calculation: {
      formula,
      inputs: [...inputs]
    }
  };
}

function solveOhmsLaw({ voltage, current, resistance }) {
  const supplied = [voltage, current, resistance].filter(Number.isFinite).length;
  if (supplied !== 2) throw new Error("Ohm's law requires exactly two known values");

  if (!Number.isFinite(current)) {
    return calculatedQuantity(
      "current",
      "A",
      requireFinite("voltage", voltage) / requirePositive("resistance", resistance),
      "I = V / R",
      ["voltage", "resistance"]
    );
  }

  if (!Number.isFinite(voltage)) {
    return calculatedQuantity(
      "voltage",
      "V",
      requireFinite("current", current) * requireFinite("resistance", resistance),
      "V = I × R",
      ["current", "resistance"]
    );
  }

  return calculatedQuantity(
    "resistance",
    "ohm",
    requireFinite("voltage", voltage) / requirePositive("current", current),
    "R = V / I",
    ["voltage", "current"]
  );
}

function calculatePower({ voltage, current }) {
  requireFinite("voltage", voltage);
  requireFinite("current", current);
  return calculatedQuantity(
    "power",
    "W",
    voltage * current,
    "P = V × I",
    ["voltage", "current"]
  );
}

function areaToSquareMeters(value, unit) {
  requirePositive("area", value);
  if (unit === "m2") return value;
  if (unit === "mm2") return value * 1e-6;
  throw new Error("area unit must be m2 or mm2");
}

function lengthToMeters(value, unit) {
  requirePositive("length", value);
  if (unit === "m") return value;
  if (unit === "mm") return value / 1000;
  throw new Error("length unit must be m or mm");
}

function calculateConductorResistance({ resistivityOhmMeter, length, lengthUnit = "m", area, areaUnit = "mm2" }) {
  requirePositive("resistivityOhmMeter", resistivityOhmMeter);
  const lengthMeters = lengthToMeters(length, lengthUnit);
  const areaSquareMeters = areaToSquareMeters(area, areaUnit);
  return calculatedQuantity(
    "resistance",
    "ohm",
    resistivityOhmMeter * lengthMeters / areaSquareMeters,
    "R = ρ × L / A",
    ["resistivity", "length", "area"]
  );
}

function calculateVoltageDrop({ current, resistance }) {
  requireFinite("current", current);
  requireFinite("resistance", resistance);
  return calculatedQuantity(
    "voltage_drop",
    "V",
    current * resistance,
    "Vdrop = I × R",
    ["current", "resistance"]
  );
}

function calculatePowerLoss({ current, resistance }) {
  requireFinite("current", current);
  requireFinite("resistance", resistance);
  return calculatedQuantity(
    "power_loss",
    "W",
    current * current * resistance,
    "Ploss = I² × R",
    ["current", "resistance"]
  );
}

function calculateLoadVoltage({ sourceVoltage, voltageDrop }) {
  requireFinite("sourceVoltage", sourceVoltage);
  requireFinite("voltageDrop", voltageDrop);
  return calculatedQuantity(
    "voltage",
    "V",
    sourceVoltage - voltageDrop,
    "Vload = Vsource − Vdrop",
    ["sourceVoltage", "voltageDrop"]
  );
}

const api = {
  calculatedQuantity,
  solveOhmsLaw,
  calculatePower,
  calculateConductorResistance,
  calculateVoltageDrop,
  calculatePowerLoss,
  calculateLoadVoltage
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TorqueMindEngineeringCalculator = api;
})();