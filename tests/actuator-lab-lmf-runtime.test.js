const fs = require('fs');
const path = require('path');
const { validateActuatorLabRuntime } = require('../scripts/verify-actuator-lab-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Actuator Lab LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateActuatorLabRuntime()).not.toThrow();
  });

  test('lab runtime resolves both the circuit template and engineering profile through the projection', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/actuator-lab/actuator-lab.js'), 'utf8');
    expect(source).toMatch(/actuator-lab-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).toMatch(/runtime\.engineeringProfileRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuit-templates\/12v-pwm-actuator\.json["']\)/);
    expect(source).not.toMatch(/fetch\(["']\/data\/engineering\/labs\/actuator-training\.json["']\)/);
  });

  test('runtime projection preserves governance boundaries', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/actuator-lab-lmf-runtime.json'), 'utf8'));
    expect(runtime.engineeringAdapterId).toBe('electrical-circuit');
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
