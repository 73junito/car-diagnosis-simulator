"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../animation/cadquery/review");
const prepare=require("node:child_process").execFileSync;
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const js=fs.readFileSync(path.join(root,"viewer.js"),"utf8");
describe("alternator review viewer local assets and fallback",()=>{
 test("import map is same-origin and pinned to locally licensed Three 0.186.1",()=>{
  expect(html).toContain('"three":"./vendor/three/build/three.module.js"');
  expect(html).toContain('"three/addons/":"./vendor/three/addons/"');
  expect(html).not.toMatch(/cdn\.jsdelivr|https:\/\/.*three/);
  prepare(process.execPath,[path.resolve(__dirname,"../scripts/prepare-alternator-review-assets.js")],{cwd:path.resolve(__dirname,"..")});
  for(const f of ["build/three.module.js","build/three.core.js","addons/loaders/GLTFLoader.js","addons/controls/OrbitControls.js","addons/utils/BufferGeometryUtils.js","addons/utils/SkeletonUtils.js","LICENSE"]){
   expect(fs.existsSync(path.join(root,"vendor/three",f))).toBe(true);
  }
  expect(fs.readFileSync(path.join(root,"vendor/three/LICENSE"),"utf8")).toContain("MIT");
 });
 test("unavailable WebGL remains understandable and disables unsafe interactions",()=>{
  expect(html).toMatch(/id="fallback" role="alert" hidden/);
  expect(html).toMatch(/id="status" role="status" aria-live="polite"/);
  expect(js).toContain("el('fallback').hidden=false");
  expect(js).toContain("play.disabled=true;pause.disabled=true;reset.disabled=true");
 });
});
