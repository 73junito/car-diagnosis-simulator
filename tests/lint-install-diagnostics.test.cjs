'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('lint workflow keeps required lint gate and bounds dependency installation', () => {
  const workflow = fs.readFileSync('.github/workflows/lint.yml', 'utf8');
  assert.match(workflow, /name: Run ESLint/);
  assert.match(workflow, /npm run lint -- --max-warnings=0/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /timeout --signal=TERM --kill-after=20s 12m npm ci --ignore-scripts --loglevel=info/);
  assert.match(workflow, /ps -eo pid,ppid,stat,etime,args/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});
