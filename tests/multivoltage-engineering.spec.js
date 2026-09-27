"use strict";

const fs=require("fs");
const path=require("path");
const calculator=require("../src/engineering/calculator");

const root=path.resolve(__dirname,"..");
const circuit=JSON.parse(fs.readFileSync(path.join(root,"data/circuit-templates/electrified-multivoltage.json"),"utf8"));

describe("multi-voltage engineering integration",()=>{
  test("template preserves explicit 12 V and 400 V training domains",()=>{
    expect(circuit.powertrainType).toBe("electrified-training");
    expect(circuit.voltageSystems).toEqual(expect.arrayContaining([
      expect.objectContaining({id:"LV12",nominalVoltage:12,unit:"V DC"}),
      expect.objectContaining({id:"TR400",nominalVoltage:400,unit:"V DC"})
    ]));
    expect(circuit.vehicleApplicability.notice).toContain("400 V traction value is an example only");
  });

  test("power calculation uses only declared voltage and explicit current",()=>{
    expect(calculator.calculatePower({voltage:12,current:10}).value).toBe(120);
    expect(calculator.calculatePower({voltage:400,current:10}).value).toBe(4000);
    expect(calculator.calculatePower({voltage:400,current:25}).value).toBe(10000);
  });

  test("fault catalog spans low-voltage and traction domains without numeric fault values",()=>{
    expect(circuit.faultCatalog.map(f=>f.id)).toEqual(expect.arrayContaining([
      "FAULT_OPEN_LV_MODULE_POWER",
      "FAULT_HIGH_RES_LV_FEED",
      "FAULT_OPEN_TRACTION_FEED",
      "FAULT_HIGH_RES_TRACTION_RETURN",
      "FAULT_OPEN_DCDC_TRACTION_INPUT"
    ]));
    expect(JSON.stringify(circuit.faultCatalog)).not.toMatch(/measured|limit|amps|watts/i);
  });
});
