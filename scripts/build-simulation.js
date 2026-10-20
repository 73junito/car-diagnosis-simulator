/**
 * Reproducible browser build for the electrical solver worker.
 *
 * Produces a single self-contained worker bundle with no external imports, no
 * network access, and no server credentials. The build is deterministic: the
 * same source produces byte-identical output, so a drift check is meaningful.
 *
 * Usage: node scripts/build-simulation.js [--check]
 *   --check  build to a temporary directory and fail if the committed bundle
 *            differs from the freshly built one
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entryPoint = path.join(root, 'src', 'simulation', 'browser-entry.ts');
const outputDirectory = path.join(root, 'dist-simulation');
const outputFile = 'mna-worker.js';

/** Patterns that must never appear in a student-facing bundle. */
const FORBIDDEN_PATTERNS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'service_role',
  'SERVICE_ROLE',
  'process.env',
  'dotenv'
];

function buildTo(outdir) {
  fs.mkdirSync(outdir, { recursive: true });
  esbuild.buildSync({
    entryPoints: [entryPoint],
    outfile: path.join(outdir, outputFile),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    logLevel: 'warning'
  });
  return path.join(outdir, outputFile);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  const check = process.argv.includes('--check');

  if (check) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gate2c-build-'));
    const fresh = buildTo(temporary);
    const committed = path.join(outputDirectory, outputFile);
    if (!fs.existsSync(committed)) {
      console.error(`[FAIL] committed bundle is missing: ${path.relative(root, committed)}`);
      process.exit(1);
    }
    const freshHash = sha256(fresh);
    const committedHash = sha256(committed);
    if (freshHash !== committedHash) {
      console.error('[FAIL] committed bundle has drifted from the source');
      console.error(`  committed: ${committedHash}`);
      console.error(`  rebuilt:   ${freshHash}`);
      process.exit(1);
    }
    console.log(`[PASS] solver bundle is reproducible: ${freshHash}`);
    return;
  }

  const built = buildTo(outputDirectory);
  const bytes = fs.statSync(built).size;
  const hash = sha256(built);
  const source = fs.readFileSync(built, 'utf8');
  const violations = FORBIDDEN_PATTERNS.filter((pattern) => source.includes(pattern));
  if (violations.length > 0) {
    console.error(`[FAIL] bundle contains forbidden content: ${violations.join(', ')}`);
    process.exit(1);
  }
  console.log(
    `[PASS] solver bundle built: ${path.relative(root, built)} (${bytes} bytes, sha256 ${hash.slice(0, 16)})`
  );
}

if (require.main === module) main();

module.exports = { buildTo, sha256, FORBIDDEN_PATTERNS, outputDirectory, outputFile };
