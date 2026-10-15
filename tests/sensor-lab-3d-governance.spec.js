/** @jest-environment node */
"use strict";

const fs=require("fs");
const path=require("path");
const {SensorLabScene,assertGovernance}=require("../src/presentation/sensor-lab-scene");

const root=path.resolve(__dirname,"..");
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");
const runtime=JSON.parse(read("data/architecture/sensor-lab-lmf-runtime.json"));
const manifest=JSON.parse(read("data/architecture/sensor-lab-3d-assets.json"));
const template=JSON.parse(read("data/circuit-templates/12v-three-wire-sensor.json"));
const profile=JSON.parse(read("data/engineering/labs/sensor-training.json"));
const classroom=read("dashboard/student/sensor-lab/sensor-lab-classroom.js");
const classroomHtml=read("dashboard/student/sensor-lab/sensor-lab-3d.html");
const indexHtml=read("dashboard/student/sensor-lab/index.html");

describe("rebased Sensor Lab multi-object classroom governance",()=>{
  test("preserves the authoritative LMF runtime contract",()=>{
    expect(runtime.runtimeRole).toBe("lmf-derived-sensor-lab-runtime");
    expect(runtime.modelRef).toBe("/data/circuit-templates/12v-three-wire-sensor.json");
    expect(runtime.engineeringProfileRef).toBe("/data/engineering/labs/sensor-training.json");
    expect(runtime.toolIds).toEqual(expect.arrayContaining(["tool.dmm","tool.oscilloscope","tool.scan-tool"]));
    expect(runtime.toolIds).not.toContain("tool.current-clamp");
    expect(runtime.assessmentEligibilityAuthority).toBe("external-governance-only");
    expect(runtime.publicationAuthority).toBe("external-human-governance-only");
  });

  test("keeps 3D presentation authority in the separate asset manifest",()=>{
    expect(manifest.authoritativeRuntime).toBe("/data/architecture/sensor-lab-lmf-runtime.json");
    expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
    expect(assertGovernance(manifest)).toEqual([]);
    expect(Object.values(manifest.authority).every((value)=>value===false)).toBe(true);
  });

  test("extends existing assets with presentation transforms only",()=>{
    expect(manifest.assets).toHaveLength(8);
    for(const asset of manifest.assets){
      expect(asset.transform).toBeDefined();
      expect(asset.transform.position).toHaveLength(3);
      expect(asset.transform.rotation).toHaveLength(3);
      expect(asset.transform.scale).toHaveLength(3);
      expect(typeof asset.transform.visible).toBe("boolean");
    }
  });

  test("runtime gating enables DMM and oscilloscope but not current clamp",()=>{
    const scene=new SensorLabScene();
    scene.loadContracts({runtime,manifest,template,profile});
    expect(scene.isToolEnabled("tool.dmm")).toBe(true);
    expect(scene.isToolEnabled("tool.oscilloscope")).toBe(true);
    expect(scene.isToolDeclared("tool.scan-tool")).toBe(true);
    expect(scene.isToolDeclared("tool.current-clamp")).toBe(false);
    expect(scene.isToolEnabled("tool.current-clamp")).toBe(false);
  });

  test("binds exactly the four existing Sensor Lab test points",()=>{
    const scene=new SensorLabScene();
    scene.loadContracts({runtime,manifest,template,profile});
    expect(scene.getTestPoints().map((tp)=>tp.id)).toEqual([
      "TP_SENSOR_SUPPLY",
      "TP_SENSOR_SIGNAL",
      "TP_SENSOR_GROUND",
      "TP_ECM_SIGNAL"
    ]);
    for(const tp of scene.getTestPoints()){
      expect(template.testPoints.some((source)=>source.id===tp.id&&source.terminalId===tp.terminalId)).toBe(true);
    }
  });

  test("probe docking changes presentation state only",()=>{
    const scene=new SensorLabScene();
    scene.loadContracts({runtime,manifest,template,profile});
    expect(scene.dockProbe("probe.red","TP_SENSOR_SIGNAL")).toBe(true);
    expect(scene.getProbe("probe.red").dockedTestPointId).toBe("TP_SENSOR_SIGNAL");
    expect(scene.undockProbe("probe.red")).toBe(true);
    expect(scene.getProbe("probe.red").dockedTestPointId).toBeNull();
  });

  test("rejects unknown faults rather than inventing behavior",()=>{
    const scene=new SensorLabScene();
    scene.loadContracts({runtime,manifest,template,profile});
    expect(scene.setActiveFault("FAULT_SIGNAL_SHORT_GROUND")).toBe(true);
    expect(scene.getActiveFault()).toBe("FAULT_SIGNAL_SHORT_GROUND");
    expect(scene.setActiveFault("FAULT_NOT_DECLARED")).toBe(false);
    expect(scene.getActiveFault()).toBe("FAULT_SIGNAL_SHORT_GROUND");
  });

  test("classroom preserves sensor-side ideal and controller-observed signal separation",()=>{
    expect(classroom).toContain('if(testPointId==="TP_SENSOR_SIGNAL")');
    expect(classroom).toContain("state.transfer.value");
    expect(classroom).toContain('if(testPointId==="TP_ECM_SIGNAL")');
    expect(classroom).toContain("state.observed");
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_SIGNAL_SHORT_GROUND").mode).toBe("controller_signal_forced_ground");
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_SIGNAL_SHORT_POWER").mode).toBe("controller_signal_forced_reference");
  });

  test("ground remains explicitly unavailable rather than inferred",()=>{
    expect(manifest.testPointBindings.find((item)=>item.testPointId==="TP_SENSOR_GROUND").displaySource).toBeNull();
    expect(classroom).toContain("No numeric value inferred by the Sensor Lab model");
  });

  test("open and degraded sensor faults preserve non-inference",()=>{
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_OPEN_SENSOR_POWER").mode).toBe("sensor_output_unavailable");
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_OPEN_SENSOR_GROUND").mode).toBe("sensor_output_unavailable");
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_HIGH_RES_SENSOR_GROUND").mode).toBe("sensor_output_not_inferred");
    expect(profile.faultBehavior.find((item)=>item.faultId==="FAULT_OPEN_SIGNAL").mode).toBe("controller_signal_unavailable");
  });

  test("standalone classroom supplements rather than replaces the existing lab",()=>{
    expect(indexHtml).toContain("sensor-lab-3d.html");
    expect(indexHtml).toContain('id="circuitSvg"');
    expect(indexHtml).toContain('id="sensor3dCanvas"');
    expect(classroomHtml).toContain("Back to 2D Sensor Lab");
    expect(classroomHtml).toContain("presentation and interaction layer");
  });

  test("classroom exposes keyboard and reduced-motion accessibility hooks",()=>{
    expect(classroom).toContain('event.key==="ArrowRight"');
    expect(classroom).toContain('event.key==="ArrowLeft"');
    const css=read("dashboard/student/sensor-lab/sensor-lab-3d.css");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
  });

  test("WebGL failure does not remove the classroom fallback",()=>{
    const scene=new SensorLabScene();
    expect(typeof scene.webglSupported).toBe("boolean");
    expect(classroomHtml).toContain('id="webglFallback"');
    expect(classroom).toContain("WebGL unavailable");
    expect(classroom).toContain("governed 2D Sensor Lab remains available");
  });

  test("3D classroom cannot grant assessment or publication authority",()=>{
    const combined=classroom+classroomHtml+JSON.stringify(manifest);
    expect(combined).not.toContain("assessmentEligible = true");
    expect(combined).not.toContain("publicationApproved = true");
    expect(combined).not.toContain('"engineeringAuthority":true');
    expect(combined).not.toContain('"measurementAuthority":true');
  });

  test("existing inline #981 3D integration remains present",()=>{
    const inline=read("dashboard/student/sensor-lab/sensor-lab-3d.js");
    expect(inline).toContain("AutoLearnProGlbViewer");
    expect(inline).toContain("declaredTools.has(asset.toolId)");
    expect(indexHtml).toContain("/src/presentation/glb-viewer.js");
    expect(indexHtml).toContain("./sensor-lab-3d.js");
  });
});
