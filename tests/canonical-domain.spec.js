/**
 * @jest-environment node
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function readRoot(file) {
  return fs.readFileSync(path.resolve(ROOT, file), 'utf8');
}

function isGitTracked(file) {
  try {
    execSync(`git ls-files --error-unmatch -- "${file}"`, {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return true;
  } catch {
    return false;
  }
}

function gitTrackedFiles() {
  return execSync('git ls-files --', {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

// Retired Vercel deployment domain — the denylist the canonical-domain
// tests use to verify the migration to app.autolearnpro.com is complete.
const OLD_DOMAIN = 'car-diagnosis-simulator.vercel.app';
const CANONICAL_DOMAIN = 'https://app.autolearnpro.com';

// Active source, config, and documentation files where the retired Vercel
// domain — or any *.vercel.app deployment URL — must never appear.
const ACTIVE_FILES = [
  'README.md',
  'config/app.config.js',
  'sitemap.xml',
  'robots.txt',
  'validate_playwright.js',
  'scripts/ui-audit/capture-pages.js',
  'public-site/index.html',
  'public-site/homepage.js',
  'public-site/robots.txt',
  'public-site/sitemap.xml',
  'worker/index.js',
  'dashboard/api-origin.js',
  'EXECUTION_COMMANDS.md',
  'SUPABASE_MIGRATION_GUIDE.md',
];

// Tracked files under these paths are allowed to preserve legacy Vercel
// references as immutable historical evidence (e.g. CI run records,
// internal AI index copies). They must not be rewritten.
const HISTORICAL_EVIDENCE_DIRS = ['runs/', '.ai/'];

// The canonical-domain regression test is the sole permitted location for
// the OLD_DOMAIN denylist string within the repository. It is excluded
// from the broad scan below.
const DETECTOR_FILE = 'tests/canonical-domain.spec.js';

// Vercel preview artifacts that were captured during the old deployment era.
const REMOVED_ARTIFACTS = [
  'preview.html',
  'vercel_preview.html',
  '.vercel/project.json',
  '.vercel/README.txt',
];

describe('canonical production domain', () => {
  // ── Explicit active-file checks (preserved + expanded) ────────────

  test.each(ACTIVE_FILES)(
    '%s does not reference the retired Vercel domain',
    (file) => {
      const content = readRoot(file);

      expect(content).not.toContain(OLD_DOMAIN);
    },
  );

  // ── Broad guard: no active tracked file may contain *.vercel.app ──

  test('no active tracked file references any *.vercel.app domain', () => {
    const pattern = /\.vercel\.app/i;
    const offenders = [];

    for (const file of gitTrackedFiles()) {
      // Skip immutable historical evidence.
      if (HISTORICAL_EVIDENCE_DIRS.some((dir) => file.startsWith(dir))) {
        continue;
      }

      // Skip the detector test — it is the one intentional location.
      if (file === DETECTOR_FILE) {
        continue;
      }

      const content = readRoot(file);
      if (pattern.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  // ── Positive canonical-domain assertions ──────────────────────────

  test('sitemap uses the canonical production domain', () => {
    const sitemap = readRoot('sitemap.xml');

    expect(sitemap).toContain(CANONICAL_DOMAIN);
  });

  test('robots points to the canonical sitemap', () => {
    const robots = readRoot('robots.txt');

    expect(robots).toContain(
      'Sitemap: https://autolearnpro.com/sitemap.xml',
    );
  });

  test('README references the canonical application URL', () => {
    const content = readRoot('README.md');

    expect(content).toContain('https://app.autolearnpro.com/');
  });

  test('README dashboard badge links to the canonical student dashboard', () => {
    const content = readRoot('README.md');

    expect(content).toContain(
      'https://app.autolearnpro.com/dashboard/student/',
    );
  });

  // ── Regression: removed Vercel artifacts are absent from the index ─

  test.each(REMOVED_ARTIFACTS)(
    '%s is not tracked in git',
    (file) => {
      expect(isGitTracked(file)).toBe(false);
    },
  );
});
