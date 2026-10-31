const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// Issue #1072: the ESLint job hung after `npm ci` completed and was cancelled
// after ~57 minutes. The accepted fix bounds the install and keeps diagnostics;
// skipping dependency lifecycle scripts is explicitly NOT the accepted fix.
// This suite runs under `npm test` (a required check) and lives in a file the
// related PR does not touch, so it cannot be relaxed by the change it guards.
describe('lint workflow install hardening (issue #1072)', () => {
  const workflow = read('.github/workflows/lint.yml');

  test('keeps the ESLint gate mandatory', () => {
    expect(workflow).toContain('name: Run ESLint');
    expect(workflow).toContain('npm run lint -- --max-warnings=0');
    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
  });

  test('bounds dependency installation with a hard timeout', () => {
    expect(workflow).toMatch(/timeout-minutes:\s*\d+/);
    expect(workflow).toMatch(/timeout --signal=TERM --kill-after=\d+s \d+m npm ci/);
  });

  test('runs dependency lifecycle scripts instead of skipping them', () => {
    expect(workflow).toContain('--foreground-scripts');
    expect(workflow).not.toContain('--ignore-scripts');
  });

  test('emits diagnostics so a post-install hang can be diagnosed', () => {
    expect(workflow).toContain('node --version');
    expect(workflow).toContain('npm --version');
    expect(workflow).toMatch(/ps -eo pid,ppid,stat,etime,args/);
    expect(workflow).toContain('::error::npm ci failed or exceeded');
  });

  test('fails the job deterministically instead of hanging', () => {
    expect(workflow).toMatch(/status=\$\?/);
    expect(workflow).toMatch(/exit "\$status"/);
  });
});
