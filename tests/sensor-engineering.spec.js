"use strict";

const fs=require("fs");
const path=require("path");
const calculator=require("../src/engineering/calculator");
const {validateEngineeringProfile}=require("../src/engineering/profiles");

const root=path.resolve(__dirname,"..");
const circuit=JSON.parse(fs.readFileSync(path.join(root,"data/circuit-templates/12v-three-wire-sensor.json"),"utf8"));
const profile=JSON.parse(fs.readFileSync(path.join(root,"data/engineering/labs/sensor-training.json"),"utf8"));

describe("sensor engineering training integration",()=>{
  const sensorProfile=profile.sensorProfile.engineeringProfile;
  const inputRange=sensorProfile.parameters.normalizedInput.range;
  const signalRange=sensorProfile.parameters.signalRange.range;
  const reference=circuit.voltageSystems.find((system)=>system.id==="SENSOR5").nominalVoltage;

  test("profile is generic training data with analog-voltage signal semantics",()=>{
    expect(profile.profileRole).toBe("lab-engineering-training-profile");
    expect(profile.circuitTemplateId).toBe("automotive-12v-three-wire-sensor");
    expect(sensorProfile.profileType).toBe("sensor");
    expect(sensorProfile.signalType).toBe("analog_voltage");
    expect(validateEngineeringProfile(sensorProfile)).toEqual([]);
    for(const quantity of Object.values(sensorProfile.parameters)){
      expect(quantity.valueRole).toBe("generic_training_example");
    }
    expect(inputRange).toEqual({min:0,nominal:50,max:100});
    expect(signalRange).toEqual({min:0.5,nominal:2.5,max:4.5});
    expect(reference).toBe(5);
  });

  test("linear transfer produces expected example signal with provenance",()=>{
    const low=calculator.calculateLinearTransfer({inputPercent:0,outputMin:signalRange.min,outputMax:signalRange.max});
    const mid=calculator.calculateLinearTransfer({inputPercent:50,outputMin:signalRange.min,outputMax:signalRange.max});
    const high=calculator.calculateLinearTransfer({inputPercent:100,outputMin:signalRange.min,outputMax:signalRange.max});
    expect(low.value).toBeCloseTo(0.5,8);
    expect(mid.value).toBeCloseTo(2.5,8);
    expect(high.value).toBeCloseTo(4.5,8);
    expect(mid.valueRole).toBe("calculated_value");
    expect(mid.calculation.formula).toContain("input%");
  });

  test("fault behavior remains explicit and does not invent high-resistance output",()=>{
    const byId=new Map(profile.faultBehavior.map((item)=>[item.faultId,item]));
    expect(byId.get("FAULT_SIGNAL_SHORT_GROUND").mode).toBe("controller_signal_forced_ground");
    expect(byId.get("FAULT_SIGNAL_SHORT_POWER")).toMatchObject({
      mode:"controller_signal_forced_reference",
      referenceVoltageSystemId:"SENSOR5"
    });
    expect(byId.get("FAULT_OPEN_SIGNAL").mode).toBe("controller_signal_unavailable");
    expect(byId.get("FAULT_OPEN_SENSOR_POWER").mode).toBe("sensor_output_unavailable");
    expect(byId.get("FAULT_OPEN_SENSOR_GROUND").mode).toBe("sensor_output_unavailable");
    expect(byId.get("FAULT_HIGH_RES_SENSOR_GROUND").mode).toBe("sensor_output_not_inferred");
  });
});
