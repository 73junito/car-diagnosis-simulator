const { createAut250MockAdapter } = require('../../dashboard/student/aut250-lab-ui/aut250-mock-adapter');

const now = () => '2026-01-01T00:00:00.000Z';

describe('AUT-250 student lab mock adapter (simulated)', () => {
  test('exposes anticipated session/record/test/repair/exportEvidence actions', () => {
    const adapter = createAut250MockAdapter({ now });
    expect(typeof adapter.session).toBe('function');
    expect(typeof adapter.record).toBe('function');
    expect(typeof adapter.test).toBe('function');
    expect(typeof adapter.repair).toBe('function');
    expect(typeof adapter.exportEvidence).toBe('function');
    expect(adapter.SIMULATED).toBe(true);
  });

  test('simulated secondary-open workflow verifies after correct coil repair', () => {
    const adapter = createAut250MockAdapter({ now });
    adapter.session();
    expect(adapter.test('coil-secondary-resistance').measurement.display).toContain('OL');
    const wrong = adapter.repair('replace-spark-plug-cylinder-3');
    expect(wrong.success).toBe(false);
    const right = adapter.repair('replace-ignition-coil-cylinder-3');
    expect(right.success).toBe(true);
    expect(adapter.test('coil-secondary-resistance').measurement.display).toContain('kΩ');
  });

  test('exported evidence is explicitly simulated and not for assessment', () => {
    const adapter = createAut250MockAdapter({ now });
    adapter.session();
    adapter.record('reasoning', { hypothesis: 'sim coil open' });
    const bundle = adapter.exportEvidence();
    expect(bundle.simulated).toBe(true);
    expect(bundle.notForAssessment).toBe(true);
    expect(bundle.events.length).toBeGreaterThan(0);
  });
});
