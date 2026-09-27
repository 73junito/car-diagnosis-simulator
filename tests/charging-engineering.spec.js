"use strict";

const fs=require("fs");
const path=require("path");
const calculator=require("../src/engineering/calculator");
const specifications=require("../src/engineering/specifications");

const root=path.resolve(__dirname,"..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"data/engineering/authoritative-specifications/delco-remy-starting-charging.json"),"utf8"));

describe("charging-system engineering references",()=>{
  const byId=id=>catalog.specifications.find(entry=>entry.id===id);

  test("charging references preserve source-backed values and comparison semantics",()=>{
    expect(byId("delco-charging-cable-new-vehicle-design-drop-12v")).toMatchObject({
      comparison:"design_basis",
      quantity:{quantityType:"voltage_drop",unit:"V",valueRole:"authoritative_specification",value:0.3},
      applicability:{system:"charging",systemVoltage:12}
    });
    expect(byId("delco-charging-cable-life-max-drop-12v")).toMatchObject({
      comparison:"maximum",
      quantity:{value:0.5}
    });
    expect(byId("delco-charging-3wire-number2-lead-max-drop-12v")).toMatchObject({
      comparison:"maximum",
      quantity:{value:0.2},
      applicability:{system:"charging",systemVoltage:12,wiringConfiguration:"3-wire",conductor:"#2 lead"}
    });
  });

  test("equivalent resistance is calculated only from an explicitly supplied current",()=>{
    const current=100;
    const design=calculator.solveOhmsLaw({voltage:0.3,current});
    const life=calculator.solveOhmsLaw({voltage:0.5,current});
    const lead=calculator.solveOhmsLaw({voltage:0.2,current});
    expect(design.value*1000).toBeCloseTo(3,8);
    expect(life.value*1000).toBeCloseTo(5,8);
    expect(lead.value*1000).toBeCloseTo(2,8);
    expect(design.valueRole).toBe("calculated_value");
  });

  test("charging references remain distinct from starting-system specifications",()=>{
    const charging=specifications.findApplicableSpecifications(catalog,{system:"charging",systemVoltage:12});
    expect(charging.map(entry=>entry.id)).toEqual(expect.arrayContaining([
      "delco-charging-cable-new-vehicle-design-drop-12v",
      "delco-charging-cable-life-max-drop-12v",
      "delco-charging-3wire-number2-lead-max-drop-12v"
    ]));
    expect(charging.some(entry=>entry.parameter==="starter_cable_total_voltage_drop")).toBe(false);
  });
});
