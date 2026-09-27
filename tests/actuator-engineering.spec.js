"use strict";

const fs=require("fs");
const path=require("path");
const calculator=require("../src/engineering/calculator");
const {validateEngineeringProfile}=require("../src/engineering/profiles");
const {validateEngineeringQuantity}=require("../src/engineering/contracts");

const root=path.resolve(__dirname,"..");
const circuit=JSON.parse(fs.readFileSync(path.join(root,"data/circuit-templates/12v-pwm-actuator.json"),"utf8"));
const profile=JSON.parse(fs.readFileSync(path.join(root,"data/engineering/labs/actuator-training.json"),"utf8"));

describe("actuator engineering training integration",()=>{
  const actuatorProfile=profile.actuatorProfile.engineeringProfile;
  const supply=circuit.voltageSystems.find(system=>system.id==="LV12").nominalVoltage;

  test("profile is generic PWM training data",()=>{
    expect(profile.profileRole).toBe("lab-engineering-training-profile");
    expect(profile.circuitTemplateId).toBe("automotive-12v-pwm-actuator");
    expect(actuatorProfile.profileType).toBe("actuator");
    expect(actuatorProfile.signalType).toBe("pwm");
    expect(validateEngineeringProfile(actuatorProfile)).toEqual([]);
    expect(actuatorProfile.parameters.dutyCycle.valueRole).toBe("generic_training_example");
    expect(actuatorProfile.parameters.dutyCycle.range).toEqual({min:0,nominal:30,max:100});
    expect(supply).toBe(12);
  });

  test("PWM average calculation preserves provenance",()=>{
    const low=calculator.calculatePwmAverage({highVoltage:supply,dutyCyclePercent:30});
    const high=calculator.calculatePwmAverage({highVoltage:supply,dutyCyclePercent:70});
    const custom=calculator.calculatePwmAverage({highVoltage:supply,dutyCyclePercent:40});
    expect(low.value).toBeCloseTo(3.6,8);
    expect(high.value).toBeCloseTo(8.4,8);
    expect(custom.value).toBeCloseTo(4.8,8);
    expect(low.valueRole).toBe("calculated_value");
    expect(low.calculation.formula).toBe("Vavg = Vhigh × (duty% / 100)");
    expect(validateEngineeringQuantity(low)).toEqual([]);
  });

  test("state duty presets are explicit generic training examples",()=>{
    expect(profile.stateEngineering.map(entry=>[entry.stateId,entry.dutyCycle.value])).toEqual([
      ["pwm-low-example",30],
      ["pwm-high-example",70]
    ]);
    for(const entry of profile.stateEngineering){
      expect(validateEngineeringQuantity(entry.dutyCycle)).toEqual([]);
      expect(entry.dutyCycle.valueRole).toBe("generic_training_example");
    }
  });

  test("fault semantics avoid inferring actuator response",()=>{
    const byId=new Map(profile.faultBehavior.map(item=>[item.faultId,item]));
    expect(byId.get("FAULT_OPEN_PWM").mode).toBe("actuator_command_unavailable");
    expect(byId.get("FAULT_PWM_SHORT_GROUND").mode).toBe("actuator_command_forced_ground");
    expect(byId.get("FAULT_PWM_SHORT_POWER").mode).toBe("actuator_command_forced_power");
    expect(byId.get("FAULT_OPEN_ACT_POWER").mode).toBe("actuator_power_unavailable");
    expect(byId.get("FAULT_OPEN_ACT_GROUND").mode).toBe("actuator_ground_unavailable");
    expect(byId.get("FAULT_HIGH_RES_ACT_POWER").mode).toBe("actuator_power_degraded");
    expect(byId.get("FAULT_HIGH_RES_ACT_GROUND").mode).toBe("actuator_ground_degraded");
  });

  test("PWM calculation rejects invalid duty cycle",()=>{
    expect(()=>calculator.calculatePwmAverage({highVoltage:12,dutyCyclePercent:-1})).toThrow(/between 0 and 100/);
    expect(()=>calculator.calculatePwmAverage({highVoltage:12,dutyCyclePercent:101})).toThrow(/between 0 and 100/);
  });
});
