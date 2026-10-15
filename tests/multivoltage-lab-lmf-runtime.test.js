const fs = require('fs');
const path = require('path');
const { validateMultiVoltageLabRuntime } = require('../scripts/verify-multivoltage-lab-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Multi-Voltage Lab LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateMultiVoltageLabRuntime()).not.toThrow();
  });

  test('lab runtime consumes the governed electrified projection', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/multivoltage-lab/multivoltage-lab.js'), 'utf8');
    expect(source).toMatch(/multivoltage-lab-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuit-templates\/electrified-multivoltage\.json["']\)/);
  });

  test('runtime projection preserves governance boundaries', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/multivoltage-lab-lmf-runtime.json'), 'utf8'));
    expect(runtime.engineeringAdapterId).toBe('electrified-multivoltage');
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
