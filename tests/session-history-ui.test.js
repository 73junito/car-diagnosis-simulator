#!/usr/bin/env node
// Lightweight runner that delegates to jest so CI can invoke this via `node tests/session-history-ui.test.js`
const cp = require('child_process');
const res = cp.spawnSync('npx', ['jest', 'tests/session-history-ui.spec.js', '--runInBand', '--colors=false'], { stdio: 'inherit' });
process.exit(res.status === null ? 1 : res.status);
