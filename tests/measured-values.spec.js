"use strict";

const contracts=require("../src/engineering/contracts");
const measurements=require("../src/engineering/measurements");

describe("measured-value engineering layer",()=>{
  test("student measurement carries explicit provenance",()=>{
    const q=measurements.createMeasuredQuantity({
      quantityType:"voltage",unit:"V",value:0.32,
      labId:"starting-system-lab",measurementId:"starter-total-cable-drop",
      testPointId:"TP_STARTER_POWER"
    });
    expect(q).toMatchObject({
      quantityType:"voltage",unit:"V",valueRole:"measured_value",value:0.32,
      measurement:{entryMethod:"student_entry",context:{labId:"starting-system-lab",measurementId:"starter-total-cable-drop",testPointId:"TP_STARTER_POWER"}}
    });
    expect(contracts.validateEngineeringQuantity(q)).toEqual([]);
  });

  test("measured value without provenance is rejected",()=>{
    expect(contracts.validateEngineeringQuantity({
      quantityType:"current",unit:"A",valueRole:"measured_value",value:10
    })).toContain("measured_value requires measurement provenance");
  });

  test("maximum authoritative reference can classify a measurement",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage_drop",unit:"V",value:0.35,
      labId:"starting-system-lab",measurementId:"starter-total-cable-drop"
    });
    const reference={comparison:"maximum",quantity:{
      quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.4,
      source:{id:"source",locator:"section"}
    }};
    expect(measurements.compareMeasurementToReference(measured,reference).status).toBe("within_reference");
    measured.value=0.45;
    expect(measurements.compareMeasurementToReference(measured,reference).status).toBe("exceeds_reference");
  });

  test("design basis remains reference-only rather than pass/fail",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage_drop",unit:"V",value:0.31,
      labId:"circuit-lab",measurementId:"charging-drop"
    });
    const reference={comparison:"design_basis",quantity:{
      quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.3,
      source:{id:"source",locator:"section"}
    }};
    expect(measurements.compareMeasurementToReference(measured,reference).status).toBe("reference_only");
  });

  test("delta between measured and calculated quantities is numeric only",()=>{
    const measured=measurements.createMeasuredQuantity({
      quantityType:"voltage",unit:"V",value:2.7,
      labId:"sensor-lab",measurementId:"controller-signal"
    });
    const expected={quantityType:"voltage",unit:"V",valueRole:"calculated_value",value:2.5,calculation:{formula:"x",inputs:["x"]}};
    expect(measurements.deltaBetween(measured,expected)).toBeCloseTo(0.2,10);
  });
});
