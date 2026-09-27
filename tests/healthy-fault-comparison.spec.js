"use strict";

const calculator=require("../src/engineering/calculator");
const measurements=require("../src/engineering/measurements");
const comparisons=require("../src/engineering/comparisons");

describe("healthy-vs-fault comparison engine",()=>{
  test("calculated training values compare as numeric delta only",()=>{
    const healthy=calculator.solveOhmsLaw({voltage:12,resistance:6});
    const faulted=calculator.solveOhmsLaw({voltage:12,resistance:7.5});
    const result=comparisons.compareQuantities(healthy,faulted,{basisRole:"generic_training_example"});
    expect(result.status).toBe("changed");
    expect(result.comparable).toBe(true);
    expect(result.delta).toBeCloseTo(-0.4,8);
    expect(result.interpretation).toBe("numeric_delta_only");
    expect(result.basisRole).toBe("generic_training_example");
  });

  test("unavailable fault values stay unavailable rather than becoming zero",()=>{
    const healthy=calculator.calculateLinearTransfer({
      inputPercent:50,outputMin:0.5,outputMax:4.5,quantityType:"voltage",unit:"V"
    });
    expect(comparisons.compareQuantities(healthy,null,{reason:"open signal path"})).toMatchObject({
      status:"unavailable",comparable:false,reason:"open signal path"
    });
  });

  test("matching values are unchanged without implying universal health",()=>{
    const a=calculator.calculatePower({voltage:12,current:2});
    const b=calculator.calculatePower({voltage:12,current:2});
    expect(comparisons.compareQuantities(a,b).status).toBe("unchanged");
  });

  test("authoritative maximum uses measured-value reference semantics",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage_drop",unit:"V",value:0.45,
      labId:"starting-system-lab",measurementId:"starter-total-cable-drop"
    });
    const reference={comparison:"maximum",quantity:{
      quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.4,
      source:{id:"source",locator:"section"}
    }};
    expect(comparisons.compareMeasuredToReference(measured,reference).status).toBe("exceeds_reference");
    expect(comparisons.compareMeasuredToReference(measured,reference,{openCircuit:true}).status).toBe("not_comparable");
  });

  test("design basis remains reference-only",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage_drop",unit:"V",value:0.31,
      labId:"circuit-lab",measurementId:"charging-drop"
    });
    const reference={comparison:"design_basis",quantity:{
      quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.3,
      source:{id:"source",locator:"section"}
    }};
    expect(comparisons.compareMeasuredToReference(measured,reference).status).toBe("reference_only");
  });

  test("inapplicable references are not comparable",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage_drop",unit:"V",value:0.2,
      labId:"circuit-lab",measurementId:"charging-drop"
    });
    const reference={comparison:"maximum",quantity:{
      quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.5,
      source:{id:"source",locator:"section"}
    }};
    const result=comparisons.compareMeasuredToReference(measured,reference,{
      applicable:false,reason:"ground path does not match charging-cable reference"
    });
    expect(result).toMatchObject({status:"not_comparable",comparable:false});
  });
});
