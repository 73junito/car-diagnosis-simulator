"use strict";

const fs=require("fs");
const path=require("path");
const profiles=require("../src/engineering/profiles");
const specs=require("../src/engineering/specifications");

const root=path.resolve(__dirname,"..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"data/engineering/authoritative-specifications/interstate-batteries-2021.json"),"utf8"));
const registry=JSON.parse(fs.readFileSync(path.join(root,"data/evidence/document-technical-references.json"),"utf8"));
const source=registry.sources.find(item=>item.source_id==="interstate-batteries-specification-sheet-2021");

describe("Interstate authoritative battery product profiles",()=>{
  test("catalog remains exact-product and citation-only",()=>{
    expect(catalog.catalogRole).toBe("authoritative-product-profiles");
    expect(catalog.rightsMode).toBe("citation-only-structured-facts");
    expect(catalog.productProfiles).toHaveLength(10);
    expect(source).toMatchObject({
      source_kind:"user-supplied-document",
      citation_allowed:true,
      ollama_eligible:false,
      reusable_chunks_allowed:false,
      transcript_ingestion_allowed:false,
      figures_reuse_allowed:false
    });
    expect(source.document_sha256).toBe("7eca6ee44f1365ea2e8483072ccb17e2eb372724ffc3d1c8427b19ab6cd43e7f");
  });

  test("all battery values validate as authoritative quantities",()=>{
    for(const entry of catalog.productProfiles){
      expect(entry.systemVoltage).toBe(12);
      expect(profiles.validateEngineeringProfile(entry.engineeringProfile)).toEqual([]);
      for(const quantity of Object.values(entry.engineeringProfile.parameters)){
        expect(quantity.valueRole).toBe("authoritative_specification");
        expect(quantity.source.id).toBe("interstate-batteries-specification-sheet-2021");
        expect(source.references.some(ref=>ref.locator===quantity.source.locator)).toBe(true);
      }
    }
  });

  test("published MT-48/H6 ratings are preserved exactly",()=>{
    const entry=specs.findProductProfile(catalog,{partNumber:"MT-48/H6",systemVoltage:12});
    expect(entry.groupSize).toBe("H6 (48)");
    expect(entry.engineeringProfile.parameters.coldCrankingCurrent.value).toBe(700);
    expect(entry.engineeringProfile.parameters.crankingCurrent32F.value).toBe(770);
    expect(entry.engineeringProfile.parameters.reserveCapacity.value).toBe(95);
    expect(entry.engineeringProfile.parameters.capacity20Hr.value).toBe(50);
  });

  test("published 31P-HD ratings are preserved exactly",()=>{
    const entry=specs.findProductProfile(catalog,{partNumber:"31P-HD",systemVoltage:12});
    const p=entry.engineeringProfile.parameters;
    expect(p.coldCrankingCurrent.value).toBe(925);
    expect(p.crankingCurrent32F.value).toBe(1110);
    expect(p.reserveCapacity.value).toBe(180);
    expect(p.capacity20Hr.value).toBe(104);
  });

  test("AGM chemistry is only asserted for explicitly AGM products",()=>{
    expect(specs.findProductProfile(catalog,{partNumber:"31P-AGM71"}).engineeringProfile.chemistry).toBe("lead_acid_agm");
    expect(specs.findProductProfile(catalog,{partNumber:"31P-HD"}).engineeringProfile.chemistry).toBeUndefined();
  });
});
