/** @jest-environment node */
const fs=require("fs");
const path=require("path");
const {ActuatorLabScene,assertGovernance}=require("../src/presentation/actuator-lab-scene.js");
const {calculateActuatorEngineeringState}=require("../src/engineering/actuator-state.js");
const calculator=require("../src/engineering/calculator");

const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const json=(p)=>JSON.parse(read(p));

describe("Actuator Lab governed 3D classroom",()=>{
 const runtime=json("data/architecture/actuator-lab-lmf-runtime.json");
 const manifest=json("data/architecture/actuator-lab-3d-assets.json");
 const template=json("data/circuit-templates/12v-pwm-actuator.json");
 const profile=json("data/engineering/labs/actuator-training.json");

 test("manifest is explicitly presentation-only",()=>{
  expect(assertGovernance(manifest)).toEqual([]);
  expect(Object.values(manifest.authority)).toEqual([false,false,false,false,false]);
  expect(manifest.authoritativeRuntime).toBe("/data/architecture/actuator-lab-lmf-runtime.json");
  expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
  expect(manifest.engineeringProfile).toBe(runtime.engineeringProfileRef);
 });

 test("binds exactly the four authoritative Actuator Lab test points",()=>{
  expect(manifest.testPointBindings.map((item)=>item.testPointId)).toEqual([
   "TP_ACT_POWER","TP_PWM","TP_ACT_GROUND","TP_ECM_PWM"
  ]);
  expect(template.testPoints.map((item)=>item.id)).toEqual([
   "TP_ACT_POWER","TP_PWM","TP_ACT_GROUND","TP_ECM_PWM"
  ]);
  expect(template.testPoints.every((item)=>item.vehicleSpecificValueRequired===true)).toBe(true);
 });

 test("real 3D assets remain presentation resources only",()=>{
  const ids=manifest.assets.map((item)=>item.assetId);
  expect(ids).toContain("component.generic-actuator");
  expect(ids).toContain("equipment.dmm");
  expect(ids).toContain("equipment.oscilloscope");
  expect(ids).toContain("equipment.current-clamp");
  expect(ids).toContain("scene.harness");
  expect(ids).toContain("scene.battery");
  expect(ids).toContain("scene.vehicle");
  expect(manifest.assets.every((item)=>item.url.endsWith(".glb"))).toBe(true);
  expect(manifest.assets.every((item)=>item.animation.mode==="presentation-auto-rotate")).toBe(true);
  for(const asset of manifest.assets){
   expect(fs.existsSync(path.join(root,asset.url.replace(/^\//,"")))).toBe(true);
  }
 });

 test("generated generic actuator GLB is valid glTF 2.0 binary and explicitly non-vehicle-specific",()=>{
  const p=path.join(root,"dashboard/student/actuator-lab/assets/3d/generic-actuator.glb");
  const buf=fs.readFileSync(p);
  expect(buf.readUInt32LE(0)).toBe(0x46546c67);
  expect(buf.readUInt32LE(4)).toBe(2);
  expect(buf.readUInt32LE(8)).toBe(buf.length);
  const jsonLength=buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a);
  const gltf=JSON.parse(buf.subarray(20,20+jsonLength).toString("utf8").trim());
  expect(gltf.asset.version).toBe("2.0");
  expect(gltf.extras.presentationOnly).toBe(true);
  expect(gltf.extras.vehicleSpecific).toBe(false);
  expect(gltf.extras.engineeringAuthority).toBe(false);
 });

 test("scene gates diagnostic-tool assets from runtime declarations",()=>{
  const scene=new ActuatorLabScene();
  const summary=scene.loadContracts({runtime,manifest,template,profile});
  expect(summary.assetCount).toBe(9);
  expect(summary.enabledToolAssetCount).toBe(3);
  expect(scene.isToolEnabled("tool.dmm")).toBe(true);
  expect(scene.isToolEnabled("tool.oscilloscope")).toBe(true);
  expect(scene.isToolEnabled("tool.current-clamp")).toBe(true);
  expect(scene.isToolDeclared("tool.scan-tool")).toBe(true);
  expect(scene.isToolEnabled("tool.scan-tool")).toBe(false);
 });

 test("probe docking changes presentation interaction only",()=>{
  const scene=new ActuatorLabScene();
  scene.loadContracts({runtime,manifest,template,profile});
  expect(scene.dockProbe("probe.red","TP_PWM")).toBe(true);
  expect(scene.getProbe("probe.red").dockedTestPointId).toBe("TP_PWM");
  expect(scene.dockProbe("probe.red","NOT_A_POINT")).toBe(false);
  expect(scene.undockProbe("probe.red")).toBe(true);
  expect(scene.getProbe("probe.red").dockedTestPointId).toBeNull();
 });

 test("shared state preserves ECM command vs actuator-side observation separation",()=>{
  const base={
   calculator,
   supplyVoltage:12,
   dutyCyclePercent:30,
   operatingState:"pwm-low-example"
  };
  const healthy=calculateActuatorEngineeringState(base);
  expect(healthy.ideal.value).toBeCloseTo(3.6,8);
  expect(healthy.observed).toBeCloseTo(3.6,8);

  const open=calculateActuatorEngineeringState({
   ...base,
   faultBehavior:{mode:"actuator_command_unavailable",reason:"open"}
  });
  expect(open.ideal.value).toBeCloseTo(3.6,8);
  expect(open.observed).toBeNull();

  const ground=calculateActuatorEngineeringState({
   ...base,
   faultBehavior:{mode:"actuator_command_forced_ground",reason:"ground"}
  });
  expect(ground.ideal.value).toBeCloseTo(3.6,8);
  expect(ground.observed).toBe(0);

  const power=calculateActuatorEngineeringState({
   ...base,
   faultBehavior:{mode:"actuator_command_forced_power",reason:"power"}
  });
  expect(power.ideal.value).toBeCloseTo(3.6,8);
  expect(power.observed).toBe(12);
 });

 test("power and ground faults never invent actuator response",()=>{
  const base={
   calculator,
   supplyVoltage:12,
   dutyCyclePercent:30,
   operatingState:"pwm-low-example"
  };
  const cases=[
   ["actuator_power_unavailable","Unavailable","Available"],
   ["actuator_ground_unavailable","Available","Unavailable"],
   ["actuator_power_degraded","Degraded","Available"],
   ["actuator_ground_degraded","Available","Degraded"]
  ];
  for(const [mode,power,ground] of cases){
   const state=calculateActuatorEngineeringState({...base,faultBehavior:{mode,reason:"No actuator response inferred."}});
   expect(state.observed).toBeCloseTo(3.6,8);
   expect(state.power).toBe(power);
   expect(state.ground).toBe(ground);
   expect(state.note).toMatch(/No actuator response inferred/i);
  }
 });

 test("classroom text explicitly rejects unmodeled physical outputs",()=>{
  const html=read("dashboard/student/actuator-lab/actuator-lab-3d.html");
  const js=read("dashboard/student/actuator-lab/actuator-lab-classroom.js");
  expect(html).toMatch(/Actual PWM frequency, waveform, test-point voltage, current, actuator position, speed, force, flow, response/i);
  expect(js).toContain("Current not inferred");
  expect(js).toContain("No actuator-response PID inferred");
  expect(js).not.toContain("actuatorPosition=");
  expect(js).not.toContain("actuatorCurrent=");
 });
});
