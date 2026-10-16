/** @jest-environment node */
const fs=require("fs");
const path=require("path");
const {MultiVoltageLabScene,assertGovernance}=require("../src/presentation/multivoltage-lab-scene.js");
const {calculateMultiVoltageEngineeringState}=require("../src/engineering/multivoltage-state.js");
const calculator=require("../src/engineering/calculator");

const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const json=(p)=>JSON.parse(read(p));

describe("Multivoltage Lab governed 3D classroom",()=>{
 const runtime=json("data/architecture/multivoltage-lab-lmf-runtime.json");
 const manifest=json("data/architecture/multivoltage-lab-3d-assets.json");
 const template=json("data/circuit-templates/electrified-multivoltage.json");

 test("manifest is explicitly presentation-only",()=>{
  expect(assertGovernance(manifest)).toEqual([]);
  expect(Object.values(manifest.authority)).toEqual([false,false,false,false,false]);
  expect(manifest.authoritativeRuntime).toBe("/data/architecture/multivoltage-lab-lmf-runtime.json");
  expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
 });

 test("binds exactly the five authoritative test points and preserves traction safety boundary",()=>{
  expect(manifest.testPointBindings.map((item)=>item.testPointId)).toEqual([
   "TP_LV_BUS","TP_CONTROL_CMD","TP_TRACTION_POS","TP_TRACTION_RETURN","TP_DCDC_LV_OUT"
  ]);
  expect(template.testPoints.map((item)=>item.id)).toEqual([
   "TP_LV_BUS","TP_CONTROL_CMD","TP_TRACTION_POS","TP_TRACTION_RETURN","TP_DCDC_LV_OUT"
  ]);
  expect(template.testPoints.every((item)=>item.vehicleSpecificValueRequired===true)).toBe(true);
  expect(manifest.testPointBindings.filter((item)=>item.trainingSafetyBoundary==="conceptual-only").map((item)=>item.testPointId))
   .toEqual(["TP_TRACTION_POS","TP_TRACTION_RETURN"]);
 });

 test("registers all four runtime diagnostic tools with real GLB assets",()=>{
  const scene=new MultiVoltageLabScene();
  const summary=scene.loadContracts({runtime,manifest,template});
  expect(summary.assetCount).toBe(11);
  expect(summary.enabledToolAssetCount).toBe(4);
  for(const toolId of runtime.toolIds)expect(scene.isToolEnabled(toolId)).toBe(true);
 });

 test("all manifest GLBs exist and generated CadQuery assets are valid glTF 2.0 binaries",()=>{
  for(const asset of manifest.assets){
   const p=path.join(root,asset.url.replace(/^\//,""));
   expect(fs.existsSync(p)).toBe(true);
   const buf=fs.readFileSync(p);
   expect(buf.readUInt32LE(0)).toBe(0x46546c67);
   expect(buf.readUInt32LE(4)).toBe(2);
  }
  const authored=manifest.assets.filter((item)=>item.sourceRole==="project-authored-cadquery-generic-training-geometry");
  expect(authored).toHaveLength(6);
  expect(authored.every((item)=>item.vehicleSpecific===false)).toBe(true);
 });

 test("shared engineering state calculates power only from explicit entered current and preserves input provenance",()=>{
  const lv={id:"LV12",nominalVoltage:12};
  const hv={id:"TR400",nominalVoltage:400};
  expect(calculateMultiVoltageEngineeringState({calculator,domain:lv,domainActive:true}).power).toBeNull();

  const entered=calculateMultiVoltageEngineeringState({calculator,domain:lv,enteredCurrentValue:10,domainActive:true});
  expect(entered.power.value).toBe(120);
  expect(entered.formula).toContain("entered 10 A");

  const measured=calculateMultiVoltageEngineeringState({
   calculator,domain:lv,enteredCurrentValue:10,currentInputRole:"measured",domainActive:true
  });
  expect(measured.power.value).toBe(120);
  expect(measured.formula).toContain("measured 10 A");

  expect(calculateMultiVoltageEngineeringState({calculator,domain:hv,enteredCurrentValue:10,domainActive:true}).power.value).toBe(4000);
 });

 test("faults never infer current or substitute a fault-derived numeric result",()=>{
  const domain={id:"TR400",nominalVoltage:400};
  for(const faultType of ["open_circuit","high_resistance"]){
   const noInput=calculateMultiVoltageEngineeringState({calculator,domain,domainActive:true,faultType});
   expect(noInput.enteredCurrentValue).toBeNull();
   expect(noInput.power).toBeNull();
   expect(noInput.status).toMatch(/no fault current|entered current is not inferred/i);

   const entered=calculateMultiVoltageEngineeringState({
    calculator,domain,enteredCurrentValue:10,domainActive:true,faultType
   });
   expect(entered.power.value).toBe(4000);
   expect(entered.comparison).toMatch(/no fault current or power is inferred/i);
  }
 });

 test("inactive domain keeps entered current as calculation input only",()=>{
  const state=calculateMultiVoltageEngineeringState({
   calculator,
   domain:{id:"TR400",nominalVoltage:400},
   enteredCurrentValue:5,
   domainActive:false
  });
  expect(state.power.value).toBe(2000);
  expect(state.status).toMatch(/calculation input only/i);
  expect(state.comparison).toMatch(/not treated as a fault measurement/i);
 });

 test("authoring pipeline remains reproducible and portable",()=>{
  const cad=read("animation/cadquery/scripts/build_multivoltage_components.py");
  const blender=read("animation/blender/scripts/convert_multivoltage_cadquery.py");
  const runner=read("scripts/build-multivoltage-3d-assets.js");
  expect(cad).toContain("CadQuery");
  expect(cad).toContain("presentationOnly");
  expect(blender).toContain("export_format=\"GLB\"");
  expect(blender).toContain("export_extras=True");
  expect(runner).toContain("findCadQueryPython");
  expect(runner).toContain("findBlender");
  expect(runner).not.toContain("rod63");
 });

 test("classroom explicitly rejects service-procedure and unmodeled physical inference",()=>{
  const html=read("dashboard/student/multivoltage-lab/multivoltage-lab-3d.html");
  const js=read("dashboard/student/multivoltage-lab/multivoltage-lab-classroom.js");
  expect(html).toMatch(/does not provide probing, PPE, interlock, isolation, discharge, depowering/i);
  expect(html).toMatch(/No current, converter efficiency, inverter switching, motor torque, motor speed/i);
  expect(js).toContain("Current not inferred");
  expect(js).toContain("Temperature not inferred");
  expect(js).toContain("Diagnostic PID not inferred");
 });
});
