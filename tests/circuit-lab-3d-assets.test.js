/** @jest-environment node */
const fs = require("fs");
const path = require("path");
const { CircuitLabScene, assertGovernance } = require("../src/presentation/circuit-lab-scene.js");
const { parseGlb, validateCircuitLab3dAssets } = require("../scripts/verify-circuit-lab-3d-assets");

const ROOT = path.resolve(__dirname, "..");
const json = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

describe("Circuit Lab 3D presentation assets", () => {
  const runtime = json("data/architecture/circuit-lab-lmf-runtime.json");
  const manifest = json("data/architecture/circuit-lab-3d-assets.json");
  const template = json("data/circuits/generic-charging-system.json");

  test("all governed 3D assets are valid GLB 2.0 triangle meshes", () => {
    const result = validateCircuitLab3dAssets();
    expect(result.assetCount).toBe(12);
    expect(result.parsed).toHaveLength(12);
    expect(result.parsed.every((asset) => asset.bytes > 0 && asset.primitives > 0)).toBe(true);
  });

  test("active 3D diagnostic tools exactly cover the Circuit Lab runtime tool contract", () => {
    const result = validateCircuitLab3dAssets();
    expect(result.activeToolIds).toEqual(["tool.current-clamp", "tool.dmm"]);
    expect(result.runtimeToolCount).toBe(2);
    expect(result.oscilloscopeEnabled).toBe(false);
  });

  test("3D presentation manifest cannot claim engineering or governance authority", () => {
    expect(assertGovernance(manifest)).toEqual([]);
    expect(Object.values(manifest.authority).every((value) => value === false)).toBe(true);
    expect(manifest.presentationRole).toBe("circuit-lab-3d-presentation-only");
    expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
  });

  test("3D scene binds exactly the authoritative Circuit Lab test points", () => {
    const scene = new CircuitLabScene();
    const summary = scene.loadContracts({ runtime, manifest, template });
    expect(summary.testPointCount).toBe(4);
    expect(scene.getTestPoints().map((point) => point.id)).toEqual([
      "TP_BAT_POS",
      "TP_ALT_BPLUS",
      "TP_MAIN_GND",
      "TP_LOAD_PWR"
    ]);
    expect(scene.getTestPoints().every((point) => point.vehicleSpecificValueRequired)).toBe(true);
  });

  test("runtime distinguishes tool capabilities from modeled and entered quantities", () => {
    expect(runtime.toolCapabilityMeasurementTypes).toEqual(runtime.measurementTypes);
    expect([...runtime.modeledMeasurementTypes].sort()).toEqual(["continuity", "voltage", "voltage_drop"]);
    expect(runtime.studentEnteredMeasurementTypes).toEqual(["current"]);
    expect(runtime.measurementSemantics).toContain("legacy tool-capability union");
    expect(runtime.modeledMeasurementTypes).not.toContain("frequency");
    expect(runtime.modeledMeasurementTypes).not.toContain("waveform");
    expect(runtime.modeledMeasurementTypes).not.toContain("current");
  });

  test("four project-authored charging components are reproducible CadQuery assets", () => {
    const result = validateCircuitLab3dAssets();
    expect(result.authoredComponentCount).toBe(4);
    const ids = manifest.assets
      .filter((asset) => asset.sourceRole === "project-authored-cadquery-generic-training-geometry")
      .map((asset) => asset.assetId);
    expect(ids).toEqual([
      "component.alternator",
      "component.regulator",
      "component.protection",
      "component.load"
    ]);
    for (const asset of manifest.assets.filter((item) => ids.includes(item.assetId))) {
      expect(asset.vehicleSpecific).toBe(false);
      expect(fs.existsSync(path.join(ROOT, "dashboard/student/circuit-lab/assets/3d", asset.file))).toBe(true);
    }
  });

  test("generated current clamp remains a generic GLB with vertex colors", () => {
    const file = path.join(ROOT, "dashboard", "student", "circuit-lab", "assets", "3d", "current-clamp.glb");
    const { gltf, primitives } = parseGlb(file);
    expect(gltf.asset.version).toBe("2.0");
    expect(gltf.asset.generator).toContain("AutoLearnPro generic low-poly current-clamp generator");
    expect(primitives.every((primitive) => primitive.attributes.COLOR_0 !== undefined)).toBe(true);
  });

  test("prototype simulation mesh JSON is not shipped as Circuit Lab engineering input", () => {
    expect(fs.existsSync(
      path.join(ROOT, "dashboard", "student", "circuit-lab", "assets", "3d", "prototype-scene-meshes.json")
    )).toBe(false);
  });
});
