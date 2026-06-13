const fs = require('fs');
const path = require('path');

const root = process.cwd();
const testsDir = path.join(root, 'tests');

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

const errorMatches = [];
const warnMatches = [];

function checkFile(file) {
  if (!file.endsWith('.js') && !file.endsWith('.mjs') && !file.endsWith('.cjs')) return;
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/require\(['\"]nock['\"]\)/.test(l) || /from\s+['\"]nock['\"]/.test(l) || /import\s+.+\bnock\b/.test(l)) {
      errorMatches.push({ file, line: i + 1, snippet: l.trim() });
    }
    if (/require\(['\"]http['\"]\)|require\(['\"]https['\"]\)|from\s+['\"]https?['\"]/.test(l)) {
      warnMatches.push({ file, line: i + 1, snippet: l.trim() });
    }
  }
}

if (!fs.existsSync(testsDir)) process.exit(0);
walk(testsDir, checkFile);

if (warnMatches.length) {
  console.warn('\n[guard-no-nock] Warnings: found http/https imports in tests (not failing):');
  for (const w of warnMatches) console.warn(`${w.file}:${w.line}: ${w.snippet}`);
}

if (errorMatches.length) {
  console.error('\n[guard-no-nock] ERROR: forbidden nock import found in tests:');
  for (const e of errorMatches) console.error(`${e.file}:${e.line}: ${e.snippet}`);
  console.error('\nPlease remove nock imports and use createFetchMock or the service boundary mocks.');
  process.exit(1);
}

process.exit(0);
