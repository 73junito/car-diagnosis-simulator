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
  "schemas",
  "services",
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
  "version.json"
];

/*
 * Additional individual public files or pages.
 *
 * The public directory is not copied wholesale because it currently appears
 * to contain files that should not automatically become public.
 */
const additionalRuntimeEntries = [
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
  "dashboard/student/scenario/index.html",
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




