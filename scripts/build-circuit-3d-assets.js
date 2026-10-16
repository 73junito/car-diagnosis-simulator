"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { findCadQueryPython } = require("./resolve-cadquery-environment");
const { findBlender } = require("./run-blender-animation-pipeline");

const root = path.resolve(__dirname, "..");
const cadScript = path.join(root, "animation", "cadquery", "scripts", "build_circuit_components.py");
const blenderScript = path.join(root, "animation", "blender", "scripts", "convert_multivoltage_cadquery.py");
const intermediateDir = path.join(root, "animation", "cadquery", "output", "circuit");
const outputDir = path.join(root, "dashboard", "student", "circuit-lab", "assets", "3d");

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(label + " exited with status " + result.status);
}

function main() {
  const python = findCadQueryPython();
  if (!python) {
    console.error("[FAIL] CadQuery Python not found. Run npm run doctor:animation-cadquery.");
    process.exit(2);
  }
  const blender = findBlender();
  if (!blender) {
    console.error("[FAIL] Blender 5.2+ not found. Set BLENDER_EXE.");
    process.exit(2);
  }
  fs.mkdirSync(intermediateDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  run(python, [cadScript], "CadQuery");
  run(blender, [
    "--background",
    "--factory-startup",
    "--python", blenderScript,
    "--",
    "--input-dir", intermediateDir,
    "--output-dir", outputDir
  ], "Blender");

  const expected = [
    "alternator-generic.glb",
    "voltage-regulator-generic.glb",
    "charging-protection-generic.glb",
    "electrical-load-generic.glb"
  ];
  const missing = expected.filter((file) => !fs.existsSync(path.join(outputDir, file)));
  if (missing.length) {
    console.error("[FAIL] Missing generated Circuit Lab GLBs: " + missing.join(", "));
    process.exit(1);
  }
  console.log("[PASS] Circuit Lab CadQuery → Blender asset build complete: " + expected.length + " GLBs");
}

if (require.main === module) main();

module.exports = { main };
