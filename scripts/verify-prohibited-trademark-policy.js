'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const protectedMark = ['A','S','E'].join('');
const lowerMark = protectedMark.toLowerCase();

const historicalPrefixes = [
  'supabase/migrations/',
  'db/migrations/'
];

const excludedFiles = new Set([
  '.ai/index.json'
]);

const binaryExtensions = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.pdf','.zip','.woff','.woff2','.ttf','.ico'
]);

const patterns = [
  {
    name: 'standalone protected mark',
    regex: new RegExp('(^|[^A-Za-z0-9])' + protectedMark + '([^A-Za-z0-9]|$)', 'i')
  },
  {
    name: 'spelled-out protected organization name',
    regex: new RegExp(['Automotive','Service','Excellence'].join('\\s+'), 'i')
  },
  {
    name: 'retired identifier prefix',
    regex: new RegExp('\\b' + lowerMark + '(?:_|-|[A-Z])')
  },
  {
    name: 'retired route/file token',
    regex: new RegExp('(?:^|[\\/_.-])' + lowerMark + '(?:[\\/_.-]|$)', 'i')
  },
  {
    name: 'retired diagnostic code value',
    regex: /diagnostic(?:Area|_area)\s*["']?\s*[:=]\s*["'](?:A[1-8]|L[13])["']/i
  }
];

function isExcluded(rel) {
  const normalized = rel.replace(/\\/g, '/');
  return historicalPrefixes.some((prefix) => normalized.startsWith(prefix)) ||
    excludedFiles.has(normalized) ||
    binaryExtensions.has(path.extname(normalized).toLowerCase());
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);

  const violations = [];
  for (const rel of files) {
    if (isExcluded(rel)) continue;
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;

    let text;
    try { text = fs.readFileSync(full, 'utf8'); }
    catch { continue; }

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const before = text.slice(0, match.index);
        const line = before.split(/\r?\n/).length;
        violations.push({ rel, line, rule: pattern.name, sample: match[0].trim() });
      }
    }

    const relNorm = rel.replace(/\\/g, '/');
    const pathPattern = new RegExp('(^|[\\/_.-])' + lowerMark + '([\\/_.-]|$)', 'i');
    if (pathPattern.test(relNorm)) {
      violations.push({ rel, line: 0, rule: 'retired token in path', sample: relNorm });
    }
  }

  if (violations.length) {
    console.error('[FAIL] Protected trademark/taxonomy references remain in active source:');
    for (const v of violations) {
      console.error('  - ' + v.rel + (v.line ? ':' + v.line : '') + ' [' + v.rule + '] ' + v.sample);
    }
    process.exit(1);
  }

  console.log('[PASS] Active source contains no prohibited trademark/taxonomy references.');
}

if (require.main === module) main();

module.exports = { patterns, isExcluded };
