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

  test('runtime projection cannot grant assessment or publication authority', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/starting-system-lmf-runtime.json'), 'utf8'));
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
