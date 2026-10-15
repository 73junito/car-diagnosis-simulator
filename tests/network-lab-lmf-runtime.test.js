const fs = require('fs');
const path = require('path');
const { validateNetworkLabRuntime } = require('../scripts/verify-network-lab-lmf-runtime');

const ROOT = path.resolve(__dirname, '..');

describe('Network Lab LMF runtime integration', () => {
  test('derived runtime projection matches canonical LMF contracts', () => {
    expect(() => validateNetworkLabRuntime()).not.toThrow();
  });

  test('lab runtime consumes the governed communications projection', () => {
    const source = fs.readFileSync(path.join(ROOT, 'dashboard/student/network-lab/network-lab.js'), 'utf8');
    expect(source).toMatch(/network-lab-lmf-runtime\.json/);
    expect(source).toMatch(/runtime\.modelRef/);
    expect(source).not.toMatch(/fetch\(["']\/data\/circuit-templates\/12v-can-lin-network\.json["']\)/);
  });

  test('runtime projection preserves governance boundaries', () => {
    const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture/network-lab-lmf-runtime.json'), 'utf8'));
    expect(runtime.engineeringAdapterId).toBe('network-communications');
    expect(runtime.assessmentEligibilityAuthority).toBe('external-governance-only');
    expect(runtime.publicationAuthority).toBe('external-human-governance-only');
    expect(runtime).not.toHaveProperty('assessmentEligible');
    expect(runtime).not.toHaveProperty('publicationApproved');
  });
});
