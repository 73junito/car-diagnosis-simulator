const request = require('supertest');
const assert = require('assert');
const { app } = require('../torquemind-api/index');
const { getRecentEvents } = require('../api/telemetry/events');

async function run() {
  const before = getRecentEvents().length;

  // missing role -> 401
  await request(app).get('/dashboard/live-session').expect(401);
  let recent = getRecentEvents();
  let last = recent[recent.length-1];
  assert.ok(last && last.type === 'access_attempt', 'missing-role should emit access_attempt');
  assert.strictEqual(last.role, 'anonymous');
  assert.strictEqual(last.source, 'none');
  assert.strictEqual(last.allowed, false);
  assert.strictEqual(last.scope, 'live-session');

  // student role -> 401
  await request(app).get('/dashboard/live-session').set('x-torquemind-role', 'student').expect(401);
  recent = getRecentEvents();
  last = recent[recent.length-1];
  assert.ok(last && last.type === 'access_attempt', 'student should emit access_attempt');
  assert.strictEqual(last.role, 'student');
  assert.strictEqual(last.allowed, false);

  // instructor -> 200
  await request(app).get('/dashboard/live-session').set('x-torquemind-role', 'instructor').expect(200);
  recent = getRecentEvents();
  last = recent[recent.length-1];
  assert.ok(last && last.type === 'access_attempt', 'instructor should emit access_attempt');
  assert.strictEqual(last.role, 'instructor');
  assert.strictEqual(last.allowed, true);

  console.log('Live-session route integration tests passed.');
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(1); });

module.exports = run;
