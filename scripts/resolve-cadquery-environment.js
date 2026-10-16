"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "animation", "cadquery", "pipeline.json");

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function candidatePythonPaths(env = process.env, platform = process.platform) {
  const config = loadConfig();
  const exe = platform === "win32" ? config.environment.pythonExecutable : "python";

  const candidates = [];
  if (env.CADQUERY_PYTHON) candidates.push(path.resolve(env.CADQUERY_PYTHON));
  if (env.CADQUERY_ENV) candidates.push(path.join(path.resolve(env.CADQUERY_ENV), exe));

  if (platform === "win32" && env.USERPROFILE) {
    candidates.push(path.join(
      env.USERPROFILE,
      ...config.environment.windowsUserProfileRelativePath.split("\\"),
      exe
    ));
  }

  if (env.CONDA_PREFIX && path.basename(env.CONDA_PREFIX).toLowerCase() === config.environment.name.toLowerCase()) {
    candidates.push(path.join(env.CONDA_PREFIX, exe));
  }

  return [...new Set(candidates)];
}

function findCadQueryPython(env = process.env, platform = process.platform) {
  return candidatePythonPaths(env, platform).find((candidate) => fs.existsSync(candidate)) || null;
}

function inspectCadQuery(pythonPath, timeoutMs = 60000) {
  const code = [
    "import json, sys",
    "import cadquery as cq",
    "print(json.dumps({'python': sys.version.split()[0], 'cadquery': getattr(cq, '__version__', 'unknown')}))"
  ].join("; ");
  const result = spawnSync(pythonPath, ["-c", code], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs
  });

  if (result.error) {
    return { ok: false, error: result.error.message, status: result.status, stdout: result.stdout, stderr: result.stderr };
  }
  if (result.status !== 0) {
    return { ok: false, error: "CadQuery import failed", status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  const line = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean).at(-1);
  try {
    return { ok: true, pythonPath, ...JSON.parse(line) };
  } catch (_) {
    return { ok: false, error: "CadQuery environment returned unreadable version metadata", status: result.status, stdout: result.stdout, stderr: result.stderr };
  }
}

function main() {
  const python = findCadQueryPython();
  if (!python) {
    console.error("[FAIL] CadQuery Python not found. Set CADQUERY_PYTHON or CADQUERY_ENV, or install Miniforge env 'cadquery' under USERPROFILE.");
    process.exit(2);
  }

  const inspected = inspectCadQuery(python);
  if (!inspected.ok) {
    console.error("[FAIL] CadQuery environment found but could not be validated.");
    if (inspected.stderr) console.error(String(inspected.stderr).trim());
    process.exit(1);
  }

  console.log("[PASS] CadQuery environment ready");
  console.log("  Python: " + inspected.python);
  console.log("  CadQuery: " + inspected.cadquery);
  console.log("  Interpreter: " + inspected.pythonPath);
}

if (require.main === module) main();

module.exports = { loadConfig, candidatePythonPaths, findCadQueryPython, inspectCadQuery };
