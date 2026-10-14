"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

/*
 * Browser-runtime directories.
 *
 * These directories contain files that may be loaded directly by HTML,
 * JavaScript modules, dynamic imports, or runtime fetch calls.
 */
const runtimeDirectories = [
  "assessment",
  "assets",
  "components",
  "config",
  "core",
  "dashboard",
  "data",
  "engine",
  "js",
  "lib",
  "modules",
  "reference-library",
  "schemas",
  "services",
  "sign-in",
  "sign-up",
  "src",
  "theme"
];

/*
 * Only these files may be copied from the repository root.
 *
 * Do not replace this with an extension-based rule. The repository root
 * contains many development JSON, HTML, JavaScript, image, and text files.
 */
const runtimeRootFiles = [
  "_headers",
  "_redirects",
  "apiClient.js",
  "auth.js",
  "health.json",
  "hero-scenarios.json",
  "index.html",
  "robots.txt",
  "scenario-registry-served.js",
  "scenarios-served.js",
  "script.js",
  "sitemap.xml",
  "style.css",
  "theme.css",
  "version.json",
  "contact.html",
  "legal-pages.css",
  "privacy.html",
  "terms.html"
];

/*
 * Additional individual public files or pages.
 *
 * The public directory is not copied wholesale because it currently appears
 * to contain files that should not automatically become public.
 */
const additionalRuntimeEntries = [
  {
    source: "animation/manifests/starting-system-voltage-drop-foundation.json",
    destination: "animation/manifests/starting-system-voltage-drop-foundation.json",
    optional: false
  },
  {
    source: "docs/index.html",
    destination: "docs/index.html",
    optional: true
  },
  {
    source: "public/favicon.ico",
    destination: "favicon.ico",
    optional: false
  },
  {
    source: "public/favicon-16x16.png",
    destination: "favicon-16x16.png",
    optional: false
  },
  {
    source: "public/favicon-32x32.png",
    destination: "favicon-32x32.png",
    optional: false
  },
  {
    source: "public/favicon-48x48.png",
    destination: "favicon-48x48.png",
    optional: false
  },
  {
    source: "public/apple-touch-icon.png",
    destination: "apple-touch-icon.png",
    optional: false
  },
  {
    source: "public/android-chrome-192x192.png",
    destination: "android-chrome-192x192.png",
    optional: false
  },
  {
    source: "public/android-chrome-512x512.png",
    destination: "android-chrome-512x512.png",
    optional: false
  },
  {
    source: "public/manifest.webmanifest",
    destination: "manifest.webmanifest",
    optional: false
  },
  {
    source: "public/version.json",
    destination: "version.json",
    optional: false
  }
];

const blockedNames = new Set([
  ".env",
  ".env.example",
  ".env.local",
  ".env.production",
  ".eslintignore",
  ".eslintrc",
  ".eslintrc.json",
  ".gitignore",
  ".gitkeep",
  ".tmp_b64.txt",
  ".vercelignore",
  "desktop.ini",
  "package-lock.json",
  "package.json",
  "package.json.b64",
  "package.json.remote.json",
  "thumbs.db",
  "vercel.disabled.json",
  "vercel.json",
  "wrangler.jsonc"
]);

const blockedExtensions = new Set([
  ".bak",
  ".b64",
  ".log",
  ".md",
  ".ps1",
  ".sql",
  ".tmp",
  ".zip"
]);

const blockedPathSegments = new Set([
  "__snapshots__",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
  "tests"
]);

const requiredOutputFiles = [
  "index.html",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "manifest.webmanifest",
  "config/routes.js",
  "dashboard/student/index.html",
  "reference-library/index.html",
  "reference-library/library.js",
  "sign-in/sign-in.css",
  "sign-in/student/index.html",
  "sign-in/student/sign-in.js",
  "sign-in/instructor/index.html",
  "sign-in/instructor/sign-in.js",
  "sign-in/recover/index.html",
  "sign-in/recover/recover.js",
  "sign-in/update-password/index.html",
  "sign-in/update-password/update-password.js",
  "sign-up/student/index.html",
  "sign-up/student/sign-up.js",
  "sign-up/instructor/index.html",
  "sign-up/instructor/sign-up.js",
  "dashboard/instructor/index.html",
  "dashboard/instructor/index.js",
  "dashboard/instructor/classroom.html",
  "dashboard/instructor/classroom.css",
  "dashboard/instructor/classroom.js",
  "dashboard/institution/index.html",
  "dashboard/institution/index.js",
  "dashboard/author/index.html",
  "dashboard/author/author.css",
  "dashboard/author/author.js",
  "dashboard/instructor/research/index.html",
  "dashboard/instructor/research/research.js",
  "dashboard/student/scenario/index.html",
  "animation/manifests/starting-system-voltage-drop-foundation.json",
  "data/architecture/student-lab-animation-source-of-truth.json",
  "theme/components/animation-player/animation-player.js",
  "theme/components/animation-player/three-runtime.js",
  "theme/components/animation-player/animation-player.css",
  "vendor/three/three.module.js",
  "vendor/three/three.core.js",
  "vendor/three/LICENSE",
  "vendor/three/addons/loaders/GLTFLoader.js",
  "vendor/three/addons/controls/OrbitControls.js",
  "vendor/three/addons/utils/BufferGeometryUtils.js",
  "vendor/three/addons/utils/SkeletonUtils.js",
  "dashboard/student/circuit-lab/index.html",
  "dashboard/student/starting-system-lab/index.html",
  "dashboard/student/starting-system-lab/starting-system-animation.js",
  "dashboard/student/relay-load-lab/index.html",
  "dashboard/student/sensor-lab/index.html",
  "dashboard/student/actuator-lab/index.html",
  "dashboard/student/network-lab/index.html",
  "dashboard/student/multivoltage-lab/index.html",
  "dashboard/student/symbol-library/index.html",
  "data/symbols/manifest.json",
  "src/symbols/index.js",
  "data/connections/electrical.json",
  "src/connections/index.js",
  "src/circuits/voltage-domains.js",
  "src/circuits/template-contracts.js",
  "data/circuits/generic-charging-system.json",
  "data/circuit-templates/12v-starting-system.json",
  "data/circuit-templates/12v-relay-controlled-load.json",
  "data/circuit-templates/12v-three-wire-sensor.json",
  "data/circuit-templates/12v-pwm-actuator.json",
  "data/circuit-templates/12v-can-lin-network.json",
  "data/circuit-templates/electrified-multivoltage.json",
  "src/circuits/contracts.js",
  "src/circuits/engine.js",
  "src/engineering/contracts.js",
  "src/engineering/profiles.js",
  "src/engineering/calculator.js",
  "src/engineering/specifications.js",
  "src/engineering/measurements.js",
  "src/engineering/comparisons.js",
  "src/engineering/artifacts.js",
  "src/engineering/index.js",
  "data/engineering/browser-artifact-registry.json",
  "data/engineering/generated/sensor-signal-short-ground.json",
  "data/engineering/generated/pwm-actuator-short-ground.json",
  "data/engineering/generated/relay-load-high-resistance.json",
  "data/engineering/generated/starting-cable-drop-within-candidate.json",
  "data/engineering/generated/starting-cable-drop-exceeds-candidate.json",
  "data/engineering/generated/starting-cable-open-unavailable.json",
  "data/engineering/training-examples.json",
  "data/engineering/authoritative-specifications/delco-remy-starting-charging.json",
  "data/engineering/authoritative-specifications/interstate-batteries-2021.json",
  "data/engineering/labs/relay-load-training.json",
  "data/engineering/labs/sensor-training.json",
  "data/engineering/labs/actuator-training.json",
  "dashboard/obd2.html",
  "dashboard/obd2-student.html",
  "data/scenarios.js",
  "data/scenario-registry.js",
  "theme/tokens.css",
  "theme/layout.css",
  "theme/dashboard.css",
  "theme/navigation.js",
  "theme/shell.js"
];

const prohibitedOutputEntries = [
  ".git",
  ".github",
  ".husky",
  ".vercel",
  "api",
  "db",
  "design-language",
  "downloaded-artifacts",
  "node_modules",
  "plans",
  "playwright-report",
  "prompts",
  "reports",
  "runs",
  "scripts",
  "skills",
  "supabase",
  "test-results",
  "tests",
  "tools",
  "torquemind-api",
  "package.json",
  "package-lock.json",
  "wrangler.jsonc"
];

function normalizeRelative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function ensureInsideOutput(destination) {
  const relative = path.relative(output, destination);

  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return;
  }

  throw new Error(`Refusing to write outside dist: ${destination}`);
}

function isBlocked(source) {
  const relative = normalizeRelative(source);
  const segments = relative.toLowerCase().split("/");
  const name = path.basename(source).toLowerCase();
  const extension = path.extname(name);

  if (name.startsWith(".")) {
    return true;
  }

  if (blockedNames.has(name)) {
    return true;
  }

  if (blockedExtensions.has(extension)) {
    return true;
  }

  return segments.some((segment) => blockedPathSegments.has(segment));
}

function copyEntry(source, destination, stats) {
  if (!fs.existsSync(source)) {
    return false;
  }

  ensureInsideOutput(destination);

  const sourceStats = fs.lstatSync(source);

  if (sourceStats.isSymbolicLink()) {
    console.warn(`Skipped symbolic link: ${normalizeRelative(source)}`);
    stats.skipped += 1;
    return false;
  }

  if (isBlocked(source)) {
    stats.skipped += 1;
    return false;
  }

  if (sourceStats.isDirectory()) {
    const entries = fs.readdirSync(source, {
      withFileTypes: true
    });

    let copiedChild = false;

    for (const entry of entries) {
      const childSource = path.join(source, entry.name);
      const childDestination = path.join(destination, entry.name);

      if (copyEntry(childSource, childDestination, stats)) {
        copiedChild = true;
      }
    }

    return copiedChild;
  }

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(source, destination);

  stats.files += 1;
  stats.bytes += sourceStats.size;

  return true;
}

function copyRuntimeDirectory(directory, stats) {
  const source = path.join(root, directory);
  const destination = path.join(output, directory);

  if (!fs.existsSync(source)) {
    console.warn(`Runtime directory not found: ${directory}`);
    stats.missingOptional += 1;
    return;
  }

  copyEntry(source, destination, stats);
}

function copyRootFile(file, stats) {
  const source = path.join(root, file);
  const destination = path.join(output, file);

  if (!fs.existsSync(source)) {
    console.warn(`Runtime root file not found: ${file}`);
    stats.missingOptional += 1;
    return;
  }

  copyEntry(source, destination, stats);
}

function copyAdditionalEntry(entry, stats) {
  const source = path.join(root, entry.source);
  const destination = path.join(output, entry.destination);

  if (!fs.existsSync(source)) {
    if (!entry.optional) {
      throw new Error(`Required source is missing: ${entry.source}`);
    }

    console.warn(`Optional public entry not found: ${entry.source}`);
    stats.missingOptional += 1;
    return;
  }

  /*
   * Explicitly approved entries are allowed even when their parent directory
   * is not copied wholesale.
   */
  const sourceStats = fs.lstatSync(source);

  if (sourceStats.isSymbolicLink()) {
    throw new Error(`Approved entry cannot be a symbolic link: ${entry.source}`);
  }

  if (sourceStats.isDirectory()) {
    copyEntry(source, destination, stats);
    return;
  }

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(source, destination);

  stats.files += 1;
  stats.bytes += sourceStats.size;
}


const threeRuntimeEntries = [
  { source: "node_modules/three/build/three.module.js", destination: "vendor/three/three.module.js", rewriteBareThree: false },
  { source: "node_modules/three/build/three.core.js", destination: "vendor/three/three.core.js", rewriteBareThree: false },
  { source: "node_modules/three/LICENSE", destination: "vendor/three/LICENSE", rewriteBareThree: false },
  { source: "node_modules/three/examples/jsm/loaders/GLTFLoader.js", destination: "vendor/three/addons/loaders/GLTFLoader.js", rewriteBareThree: true },
  { source: "node_modules/three/examples/jsm/controls/OrbitControls.js", destination: "vendor/three/addons/controls/OrbitControls.js", rewriteBareThree: true },
  { source: "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js", destination: "vendor/three/addons/utils/BufferGeometryUtils.js", rewriteBareThree: true },
  { source: "node_modules/three/examples/jsm/utils/SkeletonUtils.js", destination: "vendor/three/addons/utils/SkeletonUtils.js", rewriteBareThree: true }
];

function copyThreeRuntime(stats) {
  for (const entry of threeRuntimeEntries) {
    const source = path.join(root, entry.source);
    const destination = path.join(output, entry.destination);
    if (!fs.existsSync(source)) {
      throw new Error("Required Three.js runtime source is missing: " + entry.source);
    }
    ensureInsideOutput(destination);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (entry.rewriteBareThree) {
      const relativeCore = path.relative(path.dirname(destination), path.join(output, "vendor/three/three.module.js")).replaceAll("\\", "/");
      const specifier = relativeCore.startsWith(".") ? relativeCore : "./" + relativeCore;
      const content = fs.readFileSync(source, "utf8").replaceAll("from 'three'", "from '" + specifier + "'");
      if (content.includes("from 'three'")) {
        throw new Error("Three.js addon still contains a bare import after packaging: " + entry.source);
      }
      fs.writeFileSync(destination, content, "utf8");
      stats.files += 1;
      stats.bytes += Buffer.byteLength(content);
    } else {
      fs.copyFileSync(source, destination);
      const sourceStats = fs.statSync(source);
      stats.files += 1;
      stats.bytes += sourceStats.size;
    }
  }
}

function validateOutput() {
  const missing = requiredOutputFiles.filter(
    (relativePath) => !fs.existsSync(path.join(output, relativePath))
  );

  if (missing.length > 0) {
    throw new Error(
      [
        "Static build is missing required runtime files:",
        ...missing.map((file) => `  - ${file}`)
      ].join("\n")
    );
  }

  const leaked = prohibitedOutputEntries.filter(
    (relativePath) => fs.existsSync(path.join(output, relativePath))
  );

  if (leaked.length > 0) {
    throw new Error(
      [
        "Development content leaked into dist:",
        ...leaked.map((file) => `  - ${file}`)
      ].join("\n")
    );
  }

  const blockedFiles = [];

  for (const file of walkFiles(output)) {
    const relative = path.relative(output, file).replaceAll("\\", "/");
    const name = path.basename(file).toLowerCase();
    const extension = path.extname(name);

    if (
      name.startsWith(".") ||
      blockedNames.has(name) ||
      blockedExtensions.has(extension)
    ) {
      blockedFiles.push(relative);
    }
  }

  if (blockedFiles.length > 0) {
    throw new Error(
      [
        "Blocked files were found in dist:",
        ...blockedFiles.map((file) => `  - ${file}`)
      ].join("\n")
    );
  }
}

function* walkFiles(directory) {
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function build() {
  const stats = {
    files: 0,
    bytes: 0,
    skipped: 0,
    missingOptional: 0
  };

  fs.rmSync(output, {
    recursive: true,
    force: true
  });

  fs.mkdirSync(output, {
    recursive: true
  });

  for (const directory of runtimeDirectories) {
    copyRuntimeDirectory(directory, stats);
  }

  for (const file of runtimeRootFiles) {
    copyRootFile(file, stats);
  }

  for (const entry of additionalRuntimeEntries) {
    copyAdditionalEntry(entry, stats);
  }

  copyThreeRuntime(stats);

  validateOutput();

  console.log("");
  console.log("Static deployment assembled successfully.");
  console.log(`Output: ${output}`);
  console.log(`Files copied: ${stats.files}`);
  console.log(`Total size: ${formatBytes(stats.bytes)}`);
  console.log(`Blocked entries skipped: ${stats.skipped}`);
  console.log(`Optional entries missing: ${stats.missingOptional}`);
}

try {
  build();
} catch (error) {
  console.error("");
  console.error("Static deployment failed.");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
