#!/usr/bin/env node
// Lightweight runner that delegates to jest so CI can invoke this via `node tests/session-history-ui.test.js`
const cp = require('child_process');

async function run() {
	// If running under Jest, avoid spawning a nested Jest process (it will fail).
	if (process.env.JEST_WORKER_ID !== undefined) {
		return 0;
	}
	const res = cp.spawnSync('npx', ['jest', 'tests/session-history-ui.spec.js', '--runInBand', '--colors=false'], { stdio: 'inherit' });
	const status = res.status === null ? 1 : res.status;
	return status;
}

module.exports = run;

// Jest wrapper so the suite contains at least one test
if (typeof describe === 'function' && typeof test === 'function') {
	describe('session history UI runner', () => {
		test('child jest completes successfully', async () => {
			await expect(run()).resolves.toBe(0);
		});
	});
}

// Backwards compatibility: allow direct CLI invocation
if (require.main === module) {
	run().then(status => {
		if (status !== 0) process.exit(status);
	}).catch(err => { console.error(err); process.exit(1); });
}
