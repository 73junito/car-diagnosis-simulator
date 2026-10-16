"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
describe("Alternator review-only prototype contract",()=>{
 test("CadQuery source declares seven parts and fail-closed authority",()=>{
  const s=fs.readFileSync(path.join(root,"animation/cadquery/scripts/build_alternator_prototype.py"),"utf8");
  expect((s.match(/put\("/g)||[]).length).toBe(7);
  expect(s).toContain('"measurementAuthority":False');
  expect(s).toContain('"publicationAuthority":False');
  expect(s).toContain('"referenceIsEngineeringSource":False');
 });
 test("Blender exporter maintains named animation-eligible parts",()=>{
  const s=fs.readFileSync(path.join(root,"animation/blender/scripts/convert_alternator_prototype.py"),"utf8");
  expect(s).toContain('o["runtimeDrivenOnly"]=True');
  expect(s).toContain('o["rotationAxis"]="X"');
  expect(s).toContain('export_format="GLB"');
 });
 test("Verifier enforces governance and separated meshes",()=>{
  const s=fs.readFileSync(path.join(root,"scripts/build-alternator-prototype.js"),"utf8");
  expect(s).toContain('metadata[k]');
  expect(s).toContain('j.meshes');
  expect(s).toContain('j.animations');
 });
});
