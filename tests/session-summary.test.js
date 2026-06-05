const assert = require('assert');
const path = require('path');
const fs = require('fs');

const summary = require('../tools/session-summary');
const telemetryPath = path.join(__dirname, '..', 'reports', 'telemetry-events.json');
const outPath = path.join(__dirname, '..', 'reports', 'student-performance-report.json');

function approx(a, b, tol = 0.005) {
  return Math.abs(a - b) <= tol;
}

// ensure telemetry exists
if (!fs.existsSync(telemetryPath)) {
  console.error('Missing telemetry file:', telemetryPath);
  process.exit(2);
}

// run the summary generator
summary.run();

if (!fs.existsSync(outPath)) {
  console.error('Report not generated:', outPath);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const events = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));

// tests
assert.strictEqual(report.totalEvents, events.length, 'totalEvents should match events length');
assert.ok(Array.isArray(report.sessions), 'sessions should be an array');
assert.ok(report.sessions.length >= 1, 'at least one session expected');

// find student-1 summary
const s1 = report.sessions.find(s => s.studentId === 'student-1');
assert.ok(s1, 'student-1 session must exist');
assert.strictEqual(s1.diagnosticAccuracy, 100, 'student-1 diagnosticAccuracy expected 100');
assert.strictEqual(s1.missedSafetySteps, 0, 'student-1 missedSafetySteps expected 0');
assert.strictEqual(s1.unnecessaryToolUsage, 0, 'student-1 unnecessaryToolUsage expected 0');
assert.ok(approx(s1.averageConfidence, 0.813), `student-1 avg confidence ~0.813 got ${s1.averageConfidence}`);
assert.strictEqual(s1.timeToResolutionMs, 120000, 'student-1 timeToResolutionMs expected 120000');

// find student-2 summary
const s2 = report.sessions.find(s => s.studentId === 'student-2');
assert.ok(s2, 'student-2 session must exist');
assert.strictEqual(s2.diagnosticAccuracy, 0, 'student-2 diagnosticAccuracy expected 0');
assert.strictEqual(s2.unnecessaryToolUsage, 1, 'student-2 unnecessaryToolUsage expected 1');

console.log('All analytics tests passed.');

module.exports = function runWrapper() {
  return Promise.resolve();
};

// Provide a test wrapper for Jest CI
if (typeof test === 'function') {
  test('session-summary tool generates expected report', async () => {
    // call existing logic in file by re-requiring as module
    const summaryModule = require('../tools/session-summary');
    // run the same checks as the script: run() is synchronous
    summaryModule.run();
    const path = require('path');
    const fs = require('fs');
    const telemetryPath = path.join(__dirname, '..', 'reports', 'telemetry-events.json');
    const outPath = path.join(__dirname, '..', 'reports', 'student-performance-report.json');
    expect(fs.existsSync(outPath)).toBe(true);
  }, 30000);
}
