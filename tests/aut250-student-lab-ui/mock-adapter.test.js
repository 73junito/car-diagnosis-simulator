const { createAut250MockAdapter } = require('../../dashboard/student/aut250-lab-ui/aut250-mock-adapter');

const now = () => '2026-01-01T00:00:00.000Z';
const makeId = () => 'SIM-TEST-SESSION';

describe('AUT-250 student lab mock adapter (simulated)', () => {
  test('exposes anticipated session/record/test/repair/exportEvidence actions', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    expect(typeof adapter.session).toBe('function');
    expect(typeof adapter.record).toBe('function');
    expect(typeof adapter.test).toBe('function');
    expect(typeof adapter.repair).toBe('function');
    expect(typeof adapter.exportEvidence).toBe('function');
    expect(adapter.SIMULATED).toBe(true);
  });

  test('simulated secondary-open workflow verifies after correct coil repair', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    adapter.session();
    expect(adapter.test('coil-secondary-resistance').measurement.display).toContain('OL');
    const wrong = adapter.repair('replace-spark-plug-cylinder-3');
    expect(wrong.success).toBe(false);
    const right = adapter.repair('replace-ignition-coil-cylinder-3');
    expect(right.success).toBe(true);
    expect(adapter.test('coil-secondary-resistance').measurement.display).toContain('kΩ');
  });

  test('unsupported tests and repairs throw without falsely reporting success', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    adapter.session();
    expect(() => adapter.test('made-up-test')).toThrow(/Unsupported simulated test/);
    expect(() => adapter.repair('made-up-repair')).toThrow(/Unsupported simulated repair/);
    const bundle = adapter.exportEvidence();
    expect(bundle.repaired).toBe(false);
  });

  test('closed simulated sessions refuse further mutation', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    adapter.session();
    adapter.record('session-ended', { reason: 'done' });
    expect(() => adapter.test('scan-tool-dtc')).toThrow(/closed/);
    expect(() => adapter.repair('replace-ignition-coil-cylinder-3')).toThrow(/closed/);
    expect(() => adapter.record('reasoning', { hypothesis: 'late' })).toThrow(/closed/);
  });

  test('repair verification requires the correct simulated repair', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    adapter.session();
    const before = adapter.test('scan-tool-dtc').measurement.mil;
    const wrong = adapter.repair('replace-fuel-injector-cylinder-3');
    const stillFaulted = adapter.test('scan-tool-dtc').measurement.mil;
    const right = adapter.repair('replace-ignition-coil-cylinder-3');
    const after = adapter.test('scan-tool-dtc').measurement.mil;
    expect(before).toBe('on');
    expect(wrong.success).toBe(false);
    expect(wrong.verified).toBe(false);
    expect(stillFaulted).toBe('on');
    expect(right.success).toBe(true);
    expect(right.verified).toBe(true);
    expect(after).toBe('off');
  });

  test('exported evidence is explicitly simulated and not for assessment', () => {
    const adapter = createAut250MockAdapter({ now, makeId });
    adapter.session();
    adapter.record('reasoning', { hypothesis: 'sim coil open' });
    const bundle = adapter.exportEvidence();
    expect(bundle.simulated).toBe(true);
    expect(bundle.notForAssessment).toBe(true);
    expect(bundle.events.length).toBeGreaterThan(0);
  });
});
