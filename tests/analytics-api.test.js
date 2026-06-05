const assert = require('assert');
const { aggregateSessions } = require('../api/analytics/sessions');
const { aggregateStudents } = require('../api/analytics/students');
const { availableExports, getExportContent } = require('../api/analytics/export');

function run() {
  console.log('Running analytics API tests...');
  const sres = aggregateSessions();
  assert.strictEqual(sres.ok, true, 'sessions.ok should be true');
  assert.ok(typeof sres.totalSessions === 'number', 'totalSessions number');
  assert.ok(Array.isArray(sres.students), 'students array');

  const studs = aggregateStudents();
  assert.strictEqual(studs.ok, true);
  assert.ok(Array.isArray(studs.students), 'students array present');

  const ex = availableExports();
  assert.ok(Array.isArray(ex), 'availableExports returns array');
  if (ex.length) {
    for (const e of ex) {
      const content = getExportContent(e.name.split('.').pop());
      assert.ok(content, `content for ${e.name}`);
    }
  }

  console.log('Analytics API tests passed.');
}

if (require.main === module) run();

module.exports = run;

// Jest wrapper so CI treats this file as a test
if (typeof test === 'function') {
  test('analytics api functional checks (script) run', async () => {
    await run();
  }, 30000);
}
