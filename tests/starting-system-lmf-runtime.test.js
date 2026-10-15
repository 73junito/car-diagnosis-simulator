const fs = require('fs');
const path = require('path');
const { validateStartingSystemRuntime } = require('../scripts/verify-starting-system-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Starting System LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateStartingSystemRuntime()).not.toThrow();
  });

  test('lab runtime consumes the governed projection rather than hard-coding the model path', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/starting-system-lab/starting-system-lab.js'), 'utf8');
    expect(source).toMatch(/starting-system-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuit-templates\/12v-starting-system\.json["']\)/);
  });

  test('reference shell renders capabilities from the governed runtime projection', () => {
    const html = fs.readFileSync(path.join(ROOT, 'dashboard/student/starting-system-lab/index.html'), 'utf8');
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/starting-system-lab/starting-system-lab.js'), 'utf8');

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

  test('reference shell preserves existing Starting System controls and governed animation integration', () => {
    const html = fs.readFileSync(path.join(ROOT, 'dashboard/student/starting-system-lab/index.html'), 'utf8');
    for (const id of [
      'stateSelect',
      'faultSelect',
      'showSystemFlow',
      'traceControl',
      'tracePower',
      'traceGround',
      'resetView',
      'startingAnimationPlayer',
      'startingLegacyVisualization',
      'circuitSvg',
      'batteryReferenceSelect',
      'starterFamilySelect',
      'measuredStarterDrop'
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  test('runtime projection cannot grant assessment or publication authority', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/starting-system-lmf-runtime.json'), 'utf8'));
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
