const { verifyLmfRuntimeCoverage } = require('../scripts/verify-lmf-runtime-coverage');

describe('LMF production runtime coverage', () => {
  test('every existing lab has exactly one governed runtime projection and planned labs remain unprojected', () => {
    const result = verifyLmfRuntimeCoverage();

    expect(result.existingLabCount).toBe(7);
    expect(result.runtimeProjectionCount).toBe(7);
    expect(result.plannedLabCount).toBe(10);
    expect(result.runtimeFiles).toEqual([
      'actuator-lab-lmf-runtime.json',
      'circuit-lab-lmf-runtime.json',
      'multivoltage-lab-lmf-runtime.json',
      'network-lab-lmf-runtime.json',
      'relay-load-lab-lmf-runtime.json',
      'sensor-lab-lmf-runtime.json',
      'starting-system-lmf-runtime.json'
    ]);
  });
});
