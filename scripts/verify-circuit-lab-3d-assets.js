"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const runtime = readJson("data/architecture/circuit-lab-lmf-runtime.json");
const manifest = readJson("data/architecture/circuit-lab-3d-assets.json");
const template = readJson("data/circuits/generic-charging-system.json");
const ASSET_DIR = path.join(ROOT, "dashboard", "student", "circuit-lab", "assets", "3d");

function parseGlb(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 20) throw new Error(path.basename(file) + ": GLB too small");
  if (buffer.subarray(0, 4).toString() !== "glTF") throw new Error(path.basename(file) + ": invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error(path.basename(file) + ": expected glTF 2.0");
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error(path.basename(file) + ": declared length mismatch");

  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error(path.basename(file) + ": missing JSON chunk");
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
  const primitives = (gltf.meshes || []).flatMap((mesh) => mesh.primitives || []);
  if (!primitives.length) throw new Error(path.basename(file) + ": no mesh primitives");
  for (const primitive of primitives) {
    if (primitive.mode !== undefined && primitive.mode !== 4) {
      throw new Error(path.basename(file) + ": only triangle primitives are permitted");
    }
    if (primitive.attributes?.POSITION === undefined) throw new Error(path.basename(file) + ": primitive missing POSITION");
    if (primitive.indices === undefined) throw new Error(path.basename(file) + ": primitive missing indices");
  }
  return { buffer, gltf, primitives };
}

function validateCircuitLab3dAssets() {
  if (manifest.presentationRole !== "circuit-lab-3d-presentation-only") {
    throw new Error("3D manifest presentation role drift");
  }
  if (manifest.authoritativeRuntime !== "/data/architecture/circuit-lab-lmf-runtime.json") {
    throw new Error("3D manifest is not bound to the Circuit Lab runtime");
  }
  if (manifest.authoritativeTemplate !== runtime.modelRef) {
    throw new Error("3D manifest is not bound to the Circuit Lab model");
  }
  for (const [key, value] of Object.entries(manifest.authority || {})) {
    if (value !== false) throw new Error("3D presentation authority must remain false: " + key);
  }

  const assets = manifest.assets || [];
  const diagnosticAssets = assets.filter((asset) => asset.kind === "diagnostic-tool");
  const runtimeTools = new Set(runtime.toolIds || []);
  const activeToolAssets = diagnosticAssets.filter((asset) => runtimeTools.has(asset.toolId));
  const activeToolIds = activeToolAssets.map((asset) => asset.toolId).sort();
  const expectedToolIds = [...runtimeTools].sort();
  if (JSON.stringify(activeToolIds) !== JSON.stringify(expectedToolIds)) {
    throw new Error("Runtime-enabled diagnostic tools do not have exact 3D model coverage");
  }

  const oscilloscope = diagnosticAssets.find((asset) => asset.toolId === "tool.oscilloscope");
  if (!oscilloscope) throw new Error("Oscilloscope presentation asset metadata is missing");
  if (runtimeTools.has("tool.oscilloscope")) throw new Error("Circuit Lab unexpectedly enables tool.oscilloscope");

  const modelPointIds = template.testPoints.map((point) => point.id);
  const bindingIds = (manifest.testPointBindings || []).map((binding) => binding.testPointId);
  if (JSON.stringify(bindingIds) !== JSON.stringify(modelPointIds)) {
    throw new Error("Circuit Lab 3D test-point bindings must exactly match the authoritative model");
  }
  const componentIds = new Set(template.components.map((component) => component.id));
  for (const binding of manifest.testPointBindings || []) {
    if (binding.componentId && !componentIds.has(binding.componentId)) {
      throw new Error("Unknown componentId in Circuit Lab 3D test-point binding: " + binding.componentId);
    }
  }

  const parsed = [];
  for (const asset of assets) {
    const file = path.join(ASSET_DIR, asset.file);
    if (!fs.existsSync(file)) throw new Error("Missing 3D asset: " + asset.file);
    const info = parseGlb(file);
    parsed.push({
      assetId: asset.assetId,
      file: asset.file,
      bytes: info.buffer.length,
      primitives: info.primitives.length,
      gltf: info.gltf
    });
  }

  const authoredComponents = assets.filter((asset) => asset.sourceRole === "project-authored-cadquery-generic-training-geometry");
  if (authoredComponents.length !== 4) throw new Error("Expected four CadQuery-authored Circuit Lab component assets");
  for (const asset of authoredComponents) {
    if (asset.vehicleSpecific !== false) throw new Error(asset.assetId + " must remain explicitly non-vehicle-specific");
  }

  for (const required of [
    "animation/cadquery/scripts/build_circuit_components.py",
    "scripts/build-circuit-3d-assets.js",
    "src/presentation/circuit-lab-scene.js"
  ]) {
    if (!fs.existsSync(path.join(ROOT, required))) throw new Error("Missing Circuit Lab reproducibility/scene source: " + required);
  }

  return {
    assetCount: assets.length,
    parsed,
    activeToolIds,
    runtimeToolCount: runtimeTools.size,
    oscilloscopeEnabled: runtimeTools.has("tool.oscilloscope"),
    testPointCount: bindingIds.length,
    authoredComponentCount: authoredComponents.length
  };
}

if (require.main === module) {
  const result = validateCircuitLab3dAssets();
  console.log(
    "[PASS] Circuit Lab 3D assets: " + result.assetCount + " GLBs, " +
    result.testPointCount + " test points, " + result.authoredComponentCount + " reproducible charging components"
  );
}

module.exports = { parseGlb, validateCircuitLab3dAssets };
