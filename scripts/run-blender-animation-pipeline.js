"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultManifest = path.join(root, "animation", "manifests", "starting-system-voltage-drop-foundation.json");
const defaultOutput = path.join(root, "animation", "blender", "output", "pipeline-validation.glb");
const defaultMetadata = path.join(root, "animation", "blender", "output", "pipeline-validation.metadata.json");
const generator = path.join(root, "animation", "blender", "scripts", "build_proxy_from_manifest.py");

function findBlender() {
  const candidates = [
    process.env.BLENDER_EXE,
    process.platform === "win32" ? "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" : null,
    process.platform === "darwin" ? "/Applications/Blender.app/Contents/MacOS/Blender" : null,
    process.platform === "linux" ? "/usr/bin/blender" : null,
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function parseCli(argv) {
  const result = {
    manifest: defaultManifest,
    output: defaultOutput,
    metadata: defaultMetadata,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--manifest" && argv[i + 1]) result.manifest = path.resolve(argv[++i]);
    else if (argv[i] === "--output" && argv[i + 1]) result.output = path.resolve(argv[++i]);
    else if (argv[i] === "--metadata" && argv[i + 1]) result.metadata = path.resolve(argv[++i]);
  }
  return result;
}

function main() {
  const blender = findBlender();
  if (!blender) {
    console.error("[FAIL] Blender executable not found. Set BLENDER_EXE to Blender 5.2+.");
    process.exit(2);
  }

  const args = parseCli(process.argv);
  for (const required of [args.manifest, generator]) {
    if (!fs.existsSync(required)) {
      console.error("[FAIL] Required input missing: " + required);
      process.exit(2);
    }
  }

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.mkdirSync(path.dirname(args.metadata), { recursive: true });

  const blenderArgs = [
    "--background",
    "--factory-startup",
    "--python", generator,
    "--",
    "--manifest", args.manifest,
    "--output", args.output,
    "--metadata", args.metadata,
  ];

  const result = spawnSync(blender, blenderArgs, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    console.error("[FAIL] Blender execution failed:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("[FAIL] Blender exited with status " + result.status);
    process.exit(result.status || 1);
  }
  if (!fs.existsSync(args.output) || !fs.existsSync(args.metadata)) {
    console.error("[FAIL] Blender did not produce the required GLB and metadata outputs.");
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { findBlender, parseCli };
