"use strict";

const fs = require("fs");
const path = require("path");
const contracts = require("../src/engineering/contracts");
const profiles = require("../src/engineering/profiles");
const calculator = require("../src/engineering/calculator");

describe("engineering parameter foundation", () => {
  test("quantity contract distinguishes value roles and provenance requirements", () => {
    expect(contracts.VALUE_ROLES).toEqual([
      "declared_system_value",
      "generic_training_example",
      "calculated_value",
      "authoritative_specification",
      "measured_value"
    ]);

    expect(contracts.validateEngineeringQuantity({
      quantityType:"voltage", unit:"V", valueRole:"generic_training_example", value:12
    })).toEqual([]);

    expect(contracts.validateEngineeringQuantity({
      quantityType:"voltage", unit:"V", valueRole:"authoritative_specification", value:12
    })).toContain("authoritative_specification requires source.id");

    expect(contracts.validateEngineeringQuantity({
      quantityType:"current", unit:"A", valueRole:"calculated_value", value:2
    })).toContain("calculated_value requires calculation provenance");
  });

  test("quantity contract supports ranges and tolerances without treating them as single values", () => {
    expect(contracts.validateEngineeringQuantity({
      quantityType:"resistance",
      unit:"ohm",
      valueRole:"generic_training_example",
      range:{min:5.7,nominal:6,max:6.3},
      tolerance:{type:"percent",value:5}
    })).toEqual([]);

    expect(contracts.validateEngineeringQuantity({
      quantityType:"resistance",
      unit:"ohm",
      valueRole:"generic_training_example",
      value:6,
      range:{min:5.7,max:6.3}
    })).toContain("engineering quantity must declare exactly one of value or range");
  });

  test("profile contract keeps component-specific metadata separate from quantities", () => {
    expect(profiles.validateEngineeringProfile({
      profileType:"battery",
      chemistry:"lead_acid_flooded",
      parameters:{
        nominalVoltage:{quantityType:"voltage",unit:"V",valueRole:"generic_training_example",value:12}
      }
    })).toEqual([]);

    expect(profiles.validateEngineeringProfile({
      profileType:"conductor",
      material:"copper-training-example",
      parameters:{
        length:{quantityType:"length",unit:"m",valueRole:"generic_training_example",value:3}
      }
    })).toContain("conductor engineering profile requires area parameter");
  });

  test("Ohm's law and power calculations produce calculated values with provenance", () => {
    const current = calculator.solveOhmsLaw({voltage:12,resistance:6});
    expect(current.value).toBe(2);
    expect(current.quantityType).toBe("current");
    expect(current.valueRole).toBe("calculated_value");
    expect(current.calculation.formula).toBe("I = V / R");

    const power = calculator.calculatePower({voltage:12,current:current.value});
    expect(power.value).toBe(24);
    expect(power.calculation.formula).toBe("P = V × I");

    expect(contracts.validateEngineeringQuantity(current)).toEqual([]);
    expect(contracts.validateEngineeringQuantity(power)).toEqual([]);
  });

  test("conductor calculations require explicit engineering inputs", () => {
    const resistance = calculator.calculateConductorResistance({
      resistivityOhmMeter:1.72e-8,
      length:3,
      lengthUnit:"m",
      area:2.5,
      areaUnit:"mm2"
    });
    expect(resistance.value).toBeCloseTo(0.02064,8);

    const drop = calculator.calculateVoltageDrop({current:8,resistance:resistance.value});
    expect(drop.value).toBeCloseTo(0.16512,8);

    const loss = calculator.calculatePowerLoss({current:8,resistance:resistance.value});
    expect(loss.value).toBeCloseTo(1.32096,8);

    const loadVoltage = calculator.calculateLoadVoltage({sourceVoltage:12,voltageDrop:drop.value});
    expect(loadVoltage.value).toBeCloseTo(11.83488,8);

    expect(() => calculator.calculateConductorResistance({
      length:3,area:2.5,resistivityOhmMeter:undefined
    })).toThrow(/resistivityOhmMeter/);
  });

  test("training-example catalog never presents sample values as authoritative specifications", () => {
    const catalog = JSON.parse(fs.readFileSync(
      path.join(__dirname,"../data/engineering/training-examples.json"),"utf8"
    ));
    expect(catalog.catalogRole).toBe("generic-training-examples");
    expect(catalog.profiles).toHaveLength(3);

    for (const entry of catalog.profiles) {
      expect(profiles.validateEngineeringProfile(entry.engineeringProfile)).toEqual([]);
      for (const quantity of Object.values(entry.engineeringProfile.parameters)) {
        expect(quantity.valueRole).toBe("generic_training_example");
      }
    }
  });
});
