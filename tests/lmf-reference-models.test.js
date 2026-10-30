"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {inspectElectricalCompatibility}=require("../src/lmf-runtime");
const root=path.resolve(__dirname,"..");
test("LMF electrical reference-model registrations have safe provenance and compatible structure",()=>{
 const registry=JSON.parse(fs.readFileSync(path.join(root,"data/lmf/electrical-reference-models.json"),"utf8"));
 assert.equal(registry.registryRole,"lmf-electrical-reference-models");
 for(const model of registry.models){
  assert.equal(model.readiness,"engineering-validation-fixture");
  assert.equal(model.solverId,"typescript-mna");
  assert.equal(inspectElectricalCompatibility(model.modelRef).compatible,true);
  for(const relative of model.evidenceRefs){
   assert.ok(!relative.includes("..")&&!path.isAbsolute(relative),"unsafe evidence path");
   assert.ok(fs.statSync(path.join(root,relative)).isFile(),relative);
  }
 }
});
