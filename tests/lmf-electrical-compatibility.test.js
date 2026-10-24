"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {inspectElectricalCompatibility}=require("../src/lmf-runtime/electrical-compatibility");
test("charging model is refused for MNA until required electrical parameters and ground exist",()=>{
 const r=inspectElectricalCompatibility("/data/circuits/generic-charging-system.json");
 assert.equal(r.compatible,false);
 assert.equal(r.status,"model-requires-parameters");
 assert.ok(r.reasons.length>0);
 assert.ok(r.reasons.some(x=>x.code==="BATTERY_PARAMETER_REQUIRED"));
});
test("starting model also requires solver-ready parameters",()=>{
 const r=inspectElectricalCompatibility("/data/circuit-templates/12v-starting-system.json");
 assert.equal(r.compatible,false);
 assert.ok(r.reasons.length>0);
});
test("existing starting v2 electrical reference template passes structural preflight",()=>{
 const r=inspectElectricalCompatibility("/data/circuit-templates/12v-starting-system-v2.json");
 assert.equal(r.compatible,true);
 assert.equal(r.status,"structural-preflight-only");
 assert.equal(r.reasons.length,0);
});
test("model references cannot escape data directory",()=>{
 assert.throws(()=>inspectElectricalCompatibility("/data/../package.json"),/Unsafe model reference/);
});
