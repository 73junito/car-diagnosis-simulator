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

    expect(fs.existsSync(outPath)).toBe(true);
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

  test('student-1 summary is valid', () => {
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const s1 = report.sessions.find(
      (s) => s.studentId === 'student-1'
    );

    expect(s1).toBeTruthy();

    if (s1.diagnosticAccuracy != null) {
      expect(typeof s1.diagnosticAccuracy).toBe('number');
      expect(s1.diagnosticAccuracy).toBeGreaterThanOrEqual(0);
      expect(s1.diagnosticAccuracy).toBeLessThanOrEqual(100);
    }

    if (s1.missedSafetySteps != null) {
      expect(typeof s1.missedSafetySteps).toBe('number');
      expect(s1.missedSafetySteps).toBeGreaterThanOrEqual(0);
    }

    if (s1.unnecessaryToolUsage != null) {
      expect(typeof s1.unnecessaryToolUsage).toBe('number');
      expect(s1.unnecessaryToolUsage).toBeGreaterThanOrEqual(0);
    }

    if (s1.averageConfidence != null) {
      expect(typeof s1.averageConfidence).toBe('number');
      expect(s1.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(s1.averageConfidence).toBeLessThanOrEqual(1);

      // Optional sanity check if confidence is close to the fixture
      expect(approx(s1.averageConfidence, 0.813, 0.05)).toBe(true);
    }

    if (s1.timeToResolutionMs != null) {
      expect(typeof s1.timeToResolutionMs).toBe('number');
      expect(s1.timeToResolutionMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('student-2 summary is valid', () => {
    const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const s2 = report.sessions.find(
      (s) => s.studentId === 'student-2'
    );

    expect(s2).toBeTruthy();

    if (s2.diagnosticAccuracy != null) {
      expect(typeof s2.diagnosticAccuracy).toBe('number');
      expect(s2.diagnosticAccuracy).toBeGreaterThanOrEqual(0);
      expect(s2.diagnosticAccuracy).toBeLessThanOrEqual(100);
    }

    if (s2.unnecessaryToolUsage != null) {
      expect(typeof s2.unnecessaryToolUsage).toBe('number');
      expect(s2.unnecessaryToolUsage).toBeGreaterThanOrEqual(0);
    }

    if (s2.averageConfidence != null) {
      expect(typeof s2.averageConfidence).toBe('number');
      expect(s2.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(s2.averageConfidence).toBeLessThanOrEqual(1);
    }

    if (s2.timeToResolutionMs != null) {
      expect(typeof s2.timeToResolutionMs).toBe('number');
      expect(s2.timeToResolutionMs).toBeGreaterThanOrEqual(0);
    }
  });
});