const express = require('express');
const request = require('supertest');
const assert = require('assert');

const { registerSessionsRoutes } = require('../api/analytics/sessions');
const { registerStudentsRoutes } = require('../api/analytics/students');
const { registerExportRoutes } = require('../api/analytics/export');

async function run() {
  const app = express();
  registerSessionsRoutes(app);
  registerStudentsRoutes(app);
  registerExportRoutes(app);

  // Sessions
  const sRes = await request(app).get('/api/analytics/sessions').expect(200);
  assert.strictEqual(sRes.body.ok, true, 'sessions.ok should be true');
  assert.ok(typeof sRes.body.totalSessions === 'number');

  // Students
  const stRes = await request(app).get('/api/analytics/students').expect(200);
  assert.strictEqual(stRes.body.ok, true, 'students.ok should be true');
  assert.ok(Array.isArray(stRes.body.students));

  // Exports - default csv
  const exRes = await request(app).get('/api/analytics/export').expect(200);
  // can be CSV or JSON; just ensure we got content
  assert.ok(exRes.text && exRes.text.length > 0, 'export content present');

  // Invalid export should return 404
  await request(app).get('/api/analytics/export?format=notfound').expect(404);

  console.log('Analytics routes integration tests passed.');
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}

module.exports = run;
