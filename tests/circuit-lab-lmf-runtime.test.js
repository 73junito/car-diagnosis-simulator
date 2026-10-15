const fs = require('fs');
const path = require('path');
const { validateCircuitLabRuntime } = require('../scripts/verify-circuit-lab-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Circuit Lab LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateCircuitLabRuntime()).not.toThrow();
  });

  test('lab runtime consumes the governed projection rather than hard-coding the model path', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/circuit-lab/circuit-lab.js'), 'utf8');
    expect(source).toMatch(/circuit-lab-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuits\/generic-charging-system\.json["']\)/);
  });

  test('runtime projection cannot grant assessment or publication authority', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/circuit-lab-lmf-runtime.json'), 'utf8'));
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
