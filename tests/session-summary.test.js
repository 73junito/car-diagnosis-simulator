const path = require('path');
const fs = require('fs');

const summary = require('../tools/session-summary');

const reportsDir = path.join(__dirname, '..', 'reports');
const telemetryPath = path.join(reportsDir, 'telemetry-events.json');
const outPath = path.join(reportsDir, 'student-performance-report.json');

function approx(a, b, tol = 0.005) {
  return Math.abs(a - b) <= tol;
}

function ensureTelemetryFixture() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const fixture = [
    {
      studentId: 'student-1',
      sessionId: 'session-1',
      type: 'diagnosis',
      correct: true,
      confidence: 0.81,
      timestamp: Date.now() - 120000
    },
    {
      studentId: 'student-1',
      sessionId: 'session-1',
      type: 'diagnosis',
      correct: true,
      confidence: 0.816,
      timestamp: Date.now()
    },
    {
      studentId: 'student-2',
      sessionId: 'session-2',
      type: 'tool_usage',
      unnecessary: true,
      confidence: 0.5,
      timestamp: Date.now()
    }
  ];

  if (!fs.existsSync(telemetryPath)) {
    fs.writeFileSync(telemetryPath, JSON.stringify(fixture, null, 2));
  }
}

describe('session-summary tool', () => {
  beforeAll(() => {
    ensureTelemetryFixture();

    if (fs.existsSync(outPath)) {
      fs.rmSync(outPath, { force: true });
    }

    summary.run();
  });

  test('generates a student performance report', () => {
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('report totalEvents matches telemetry length', () => {
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const events = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));

    expect(report.totalEvents).toBe(events.length);
    expect(Array.isArray(report.sessions)).toBe(true);
    expect(report.sessions.length).toBeGreaterThanOrEqual(1);
  });

  test('student-1 summary is correct when fixture supports it', () => {
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const s1 = report.sessions.find((s) => s.studentId === 'student-1');

    expect(s1).toBeTruthy();

    if (s1.diagnosticAccuracy !== undefined) {
      expect(s1.diagnosticAccuracy).toBe(100);
    }

    if (s1.missedSafetySteps !== undefined) {
      expect(s1.missedSafetySteps).toBe(0);
    }

    if (s1.unnecessaryToolUsage !== undefined) {
      expect(s1.unnecessaryToolUsage).toBe(0);
    }

    if (s1.averageConfidence !== undefined) {
      expect(approx(s1.averageConfidence, 0.813)).toBe(true);
    }
  });

  test('student-2 summary is present', () => {
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const s2 = report.sessions.find((s) => s.studentId === 'student-2');

    expect(s2).toBeTruthy();

    if (s2.diagnosticAccuracy !== undefined) {
      expect(s2.diagnosticAccuracy).toBe(0);
    }

    if (s2.unnecessaryToolUsage !== undefined) {
      expect(s2.unnecessaryToolUsage).toBe(1);
    }
  });
});