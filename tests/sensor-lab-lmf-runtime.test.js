const fs = require('fs');
const path = require('path');
const { validateSensorLabRuntime } = require('../scripts/verify-sensor-lab-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Sensor Lab LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateSensorLabRuntime()).not.toThrow();
  });

  test('lab runtime resolves both the circuit template and engineering profile through the projection', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/sensor-lab/sensor-lab.js'), 'utf8');
    expect(source).toMatch(/sensor-lab-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).toMatch(/runtime\.engineeringProfileRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuit-templates\/12v-three-wire-sensor\.json["']\)/);
    expect(source).not.toMatch(/fetch\(["']\/data\/engineering\/labs\/sensor-training\.json["']\)/);
  });

  test('reference shell renders capabilities from the governed runtime projection', () => {
    const html = fs.readFileSync(path.join(ROOT, 'dashboard/student/sensor-lab/index.html'), 'utf8');
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/sensor-lab/sensor-lab.js'), 'utf8');

    for (const text of [
      'Safety &amp; limitations',
      'Scenario / work area',
      'Diagnostic tools',
      'Evidence &amp; observations',
      'Diagnostic reasoning',
      'Model status · explicit limitations'
    ]) {
      expect(html).toContain(text);
    }

    for (const id of ['labToolList', 'labMeasurementList', 'labFaultList', 'labModelStatus']) {
      expect(html).toContain(`id="${id}"`);
    }

    expect(source).toContain('runtime.toolIds');
    expect(source).toContain('runtime.measurementTypes');
    expect(source).toContain('runtime.faultClassIds');
    expect(source).toContain('runtime.directPracticeAllowed');
    expect(source).toContain('runtime.assessmentEligibilityAuthority');
    expect(source).toContain('runtime.publicationAuthority');
  });

  test('reference shell preserves existing Sensor Lab controls and engineering inputs', () => {
    const html = fs.readFileSync(path.join(ROOT, 'dashboard/student/sensor-lab/index.html'), 'utf8');
    for (const id of [
      'stateSelect',
      'faultSelect',
      'showSystemFlow',
      'tracePower',
      'traceSignal',
      'traceGround',
      'resetView',
      'circuitSvg',
      'inspectorContent',
      'sensorInput',
      'measuredSensorSignal',
      'sensorMeasurementResult',
      'sensorComparisonSummary'
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  test('runtime projection preserves governance boundaries', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/sensor-lab-lmf-runtime.json'), 'utf8'));
    expect(runtime.engineeringAdapterId).toBe('electrical-circuit');
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
