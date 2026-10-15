/** @jest-environment node */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

describe("Sensor Lab 3D classroom presentation integration", () => {
  const html = read("dashboard/student/sensor-lab/index.html");
  const js = read("dashboard/student/sensor-lab/sensor-lab-3d.js");
  const manifest = JSON.parse(read("data/architecture/sensor-lab-3d-assets.json"));
  const runtime = JSON.parse(read("data/architecture/sensor-lab-lmf-runtime.json"));
  const template = JSON.parse(read("data/circuit-templates/12v-three-wire-sensor.json"));

  test("binds presentation metadata to authoritative Sensor Lab contracts", () => {
    expect(manifest.authoritativeRuntime).toBe("/data/architecture/sensor-lab-lmf-runtime.json");
    expect(manifest.authoritativeTemplate).toBe(runtime.modelRef);
    expect(Object.values(manifest.authority).some(Boolean)).toBe(false);
    expect(js).toContain('fetch("/data/architecture/sensor-lab-lmf-runtime.json")');
    expect(js).toContain('fetch("/data/circuit-templates/12v-three-wire-sensor.json")');
  });

  test("uses only runtime-declared diagnostic tool authority", () => {
    const tools = new Map(manifest.assets.filter((item) => item.kind === "diagnostic-tool").map((item) => [item.toolId, item]));
    expect(runtime.toolIds).toContain("tool.dmm");
    expect(runtime.toolIds).toContain("tool.oscilloscope");
    expect(runtime.toolIds).toContain("tool.scan-tool");
    expect(runtime.toolIds).not.toContain("tool.current-clamp");
    expect(tools.has("tool.dmm")).toBe(true);
    expect(tools.has("tool.oscilloscope")).toBe(true);
    expect(tools.has("tool.current-clamp")).toBe(true);
    expect(js).toContain('declaredTools.has(asset.toolId)');
  });

  test("maps the four existing Sensor Lab test points without creating new measurement semantics", () => {
    expect(manifest.testPointBindings.map((item) => item.testPointId)).toEqual([
      "TP_SENSOR_SUPPLY",
      "TP_SENSOR_SIGNAL",
      "TP_SENSOR_GROUND",
      "TP_ECM_SIGNAL"
    ]);
    expect(template.testPoints.map((item) => item.id)).toEqual(expect.arrayContaining(
      manifest.testPointBindings.map((item) => item.testPointId)
    ));
    expect(manifest.testPointBindings.find((item) => item.testPointId === "TP_SENSOR_GROUND").displaySource).toBeNull();
    expect(js).toContain("No numeric value inferred by the Sensor Lab model");
  });

  test("adds the 3D classroom while preserving the existing engineering work area", () => {
    for (const id of [
      "sensor3dCanvas",
      "sensor3dAssetList",
      "sensor3dTestPoint",
      "sensor3dBindingValue",
      "sensor3dFaultState",
      "stateSelect",
      "faultSelect",
      "sensorInput",
      "engIdealSignal",
      "engObservedSignal",
      "circuitSvg"
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("/src/presentation/glb-viewer.js");
    expect(html).toContain("./sensor-lab-3d.js");
  });

  test("does not add UI-owned engineering, assessment, or publication authority", () => {
    const combined = `${html}\n${js}\n${JSON.stringify(manifest)}`;
    expect(combined).not.toContain("assessmentEligible = true");
    expect(combined).not.toContain("publicationApproved = true");
    expect(combined).not.toContain("engineeringAuthority\":true");
    expect(combined).not.toContain("measurementAuthority\":true");
  });
});
