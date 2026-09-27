"use strict";

const fs=require("fs");
const path=require("path");
const contracts=require("../src/engineering/contracts");
const specifications=require("../src/engineering/specifications");

const root=path.resolve(__dirname,"..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"data/engineering/authoritative-specifications/delco-remy-starting-charging.json"),"utf8"));
const external=JSON.parse(fs.readFileSync(path.join(root,"data/evidence/external-technical-references.json"),"utf8").replace(/^\uFEFF/,""));
const externalById=new Map(external.sources.map(source=>[source.source_id,source]));

describe("authoritative engineering specifications",()=>{
  test("Delco Remy catalog remains citation-only and source-specific",()=>{
    expect(catalog.catalogRole).toBe("authoritative-specifications");
    expect(catalog.rightsMode).toBe("citation-only-structured-facts");
    expect(catalog.specifications).toHaveLength(14);

    for(const entry of catalog.specifications){
      expect(specifications.validateAuthoritativeSpecification(entry)).toEqual([]);
      expect(entry.quantity.valueRole).toBe("authoritative_specification");
      const source=externalById.get(entry.quantity.source.id);
      expect(source).toBeDefined();
      expect(source.evidence_role).toBe("external-technical-reference");
      expect(source.citation_allowed).toBe(true);
      expect(source.ollama_eligible).toBe(false);
      expect(source.reusable_chunks_allowed).toBe(false);
      expect(source.references.some(reference=>reference.locator===entry.quantity.source.locator)).toBe(true);
    }
  });

  test("authoritative quantity requires both source id and locator",()=>{
    expect(contracts.validateEngineeringQuantity({
      quantityType:"voltage",unit:"V",valueRole:"authoritative_specification",value:12,source:{id:"source-1"}
    })).toContain("authoritative_specification requires source.locator");

    expect(contracts.validateEngineeringQuantity({
      quantityType:"voltage",unit:"V",valueRole:"authoritative_specification",value:12,
      source:{id:"source-1",locator:"PDF p. 1"}
    })).toEqual([]);
  });

  test("starting-system cable test currents remain voltage-specific",()=>{
    const current12=specifications.selectMostSpecificSpecification(catalog,{
      system:"starting",systemVoltage:12,parameter:"starter_cable_test_current"
    });
    const current24=specifications.selectMostSpecificSpecification(catalog,{
      system:"starting",systemVoltage:24,parameter:"starter_cable_test_current"
    });
    expect(current12.quantity.value).toBe(500);
    expect(current24.quantity.value).toBe(250);
  });

  test("model-family-specific cable loss outranks general heavy-duty limit",()=>{
    const mt50=specifications.selectMostSpecificSpecification(catalog,{
      system:"starting",systemVoltage:12,starterFamily:"50MT",parameter:"starter_cable_total_voltage_drop"
    });
    const mt37=specifications.selectMostSpecificSpecification(catalog,{
      system:"starting",systemVoltage:12,starterFamily:"37MT",parameter:"starter_cable_total_voltage_drop"
    });
    expect(mt50.id).toBe("delco-starter-total-drop-12v-50mt");
    expect(mt50.quantity.value).toBe(0.4);
    expect(mt37.id).toBe("delco-starter-total-drop-12v-37-42mt");
    expect(mt37.quantity.value).toBe(0.5);
  });

  test("24 V model-family lookup does not inherit 12 V limits",()=>{
    const spec=specifications.selectMostSpecificSpecification(catalog,{
      system:"starting",systemVoltage:24,starterFamily:"50MT",parameter:"starter_cable_total_voltage_drop"
    });
    expect(spec.id).toBe("delco-starter-total-drop-24v-37-50mt");
    expect(spec.quantity.value).toBe(1);
  });

  test("catalog includes control, duration, instrumentation, and charging boundaries",()=>{
    const ids=new Set(catalog.specifications.map(entry=>entry.id));
    expect(ids).toContain("delco-hd-ims-start-enable-good-threshold-2025");
    expect(ids).toContain("delco-slow-cranking-duration-warning");
    expect(ids).toContain("delco-diagnostic-voltmeter-range-12v");
    expect(ids).toContain("delco-charging-cable-new-vehicle-design-drop-12v");
    expect(ids).toContain("delco-charging-3wire-number2-lead-max-drop-12v");
  });
});
