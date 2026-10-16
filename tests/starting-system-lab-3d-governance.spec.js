/** @jest-environment node */
const fs=require("fs");
const path=require("path");
const {StartingSystemLabScene,assertGovernance}=require("../src/presentation/starting-system-lab-scene.js");
const {validateStartingSystemLab3dAssets}=require("../scripts/verify-starting-system-lab-3d-assets.js");

const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const json=(p)=>JSON.parse(read(p));

describe("Starting System governed 3D classroom",()=>{
 const runtime=json("data/architecture/starting-system-lmf-runtime.json");
 const manifest=json("data/architecture/starting-system-lab-3d-assets.json");
 const template=json("data/circuit-templates/12v-starting-system.json");

 test("manifest is explicitly presentation-only and bound to authoritative contracts",()=>{
  expect(assertGovernance(manifest)).toEqual([]);
  expect(Object.values(manifest.authority)).toEqual([false,false,false,false,false]);
  expect(manifest.authoritativeRuntime).toBe("/data/architecture/starting-system-lmf-runtime.json");
  expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
 });

 test("scene binds exactly all four authoritative test points",()=>{
  const scene=new StartingSystemLabScene();
  const summary=scene.loadContracts({runtime,manifest,template});
  expect(summary.testPointCount).toBe(4);
  expect(scene.getTestPoints().map((point)=>point.id)).toEqual([
   "TP_BAT_POS","TP_START_CMD","TP_SOLENOID_OUT","TP_MOTOR_GND"
  ]);
  expect(scene.getTestPoints().every((point)=>point.vehicleSpecificValueRequired===true)).toBe(true);
 });

 test("all runtime tools have real 3D asset coverage",()=>{
  const scene=new StartingSystemLabScene();
  const summary=scene.loadContracts({runtime,manifest,template});
  expect(summary.assetCount).toBe(9);
  expect(summary.enabledToolAssetCount).toBe(2);
  expect(scene.isToolEnabled("tool.dmm")).toBe(true);
  expect(scene.isToolEnabled("tool.current-clamp")).toBe(true);
 });

 test("runtime distinguishes tool capability, modeled, and student-entered measurement semantics",()=>{
  expect(runtime.toolCapabilityMeasurementTypes).toEqual(runtime.measurementTypes);
  expect([...runtime.modeledMeasurementTypes].sort()).toEqual(["continuity","voltage","voltage_drop"]);
  expect(runtime.studentEnteredMeasurementTypes).toEqual(["voltage_drop"]);
  expect(runtime.measurementSemantics).toContain("legacy tool-capability union");
  expect(runtime.modeledMeasurementTypes).not.toContain("current");
  expect(runtime.modeledMeasurementTypes).not.toContain("frequency");
  expect(runtime.modeledMeasurementTypes).not.toContain("waveform");
 });

 test("four Starting System component GLBs are reproducible CadQuery assets",()=>{
  const result=validateStartingSystemLab3dAssets();
  expect(result.assetCount).toBe(9);
  expect(result.authoredComponentCount).toBe(4);
  expect(result.parsed.every((asset)=>asset.bytes>0&&asset.primitives>0)).toBe(true);
  const authored=manifest.assets.filter((asset)=>asset.sourceRole==="project-authored-cadquery-generic-training-geometry");
  expect(authored.map((asset)=>asset.assetId)).toEqual([
   "component.starter-motor",
   "component.starter-solenoid",
   "component.start-switch",
   "component.control-protection"
  ]);
  expect(authored.every((asset)=>asset.vehicleSpecific===false)).toBe(true);
 });

 test("classroom cannot bypass blocked instructional-animation review asset",()=>{
  const html=read("dashboard/student/starting-system-lab/starting-system-lab-3d.html");
  const js=read("dashboard/student/starting-system-lab/starting-system-lab-classroom.js");
  const promotion=json("animation/promotion/starting-system-voltage-drop-promotion.json");
  expect(promotion.governance.publicationAllowed).toBe(false);
  expect(promotion.governance.promotionMayProceed).toBe(false);
  expect(html+js).not.toContain("starting-system-voltage-drop-review.glb");
  expect(html).toMatch(/separate engineering-derived instructional animation remains under its own human-review and publication gates/i);
 });

 test("classroom explicitly rejects starter performance and vehicle-specific inference",()=>{
  const html=read("dashboard/student/starting-system-lab/starting-system-lab-3d.html");
  const js=read("dashboard/student/starting-system-lab/starting-system-lab-classroom.js");
  expect(html).toMatch(/No starter current, motor speed, torque, solenoid force, cranking RPM, voltage drop/i);
  expect(js).toMatch(/does not simulate starter current, speed, torque, solenoid force, cranking RPM/i);
 });

 test("authoring and deployment sources remain reproducible",()=>{
  expect(fs.existsSync(path.join(root,"animation/cadquery/scripts/build_starting_system_components.py"))).toBe(true);
  expect(fs.existsSync(path.join(root,"scripts/build-starting-system-3d-assets.js"))).toBe(true);
  expect(read("scripts/build-starting-system-3d-assets.js")).toContain("findCadQueryPython");
  expect(read("scripts/build-starting-system-3d-assets.js")).toContain("findBlender");
  expect(read("scripts/build-starting-system-3d-assets.js")).not.toContain("rod63");
 });
});
