const { createScanTool, normalizeScanToolPayload } = require('../../dashboard/student/aut250-lab-assets/src/scan-tool');

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

const PAYLOAD = {
  vehicle: { demoLabel: 'Supplied training vehicle', demoConfiguration: 'four-cylinder' },
  dtcs: [{ code: 'DEMO-1', description: 'Supplied description', status: 'supplied status' }],
  freezeFrame: { dtcCode: 'DEMO-1', conditions: [{ label: 'Supplied speed', value: 1450, unit: 'rpm' }] },
  liveData: [{ pid: 'DEMO-PID', label: 'Supplied trim', value: 2.4, unit: '%' }],
  misfireCounters: [{ cylinder: 'Supplied cylinder 1', count: 3, window: 'supplied window' }],
  operatingConditions: [{ label: 'Supplied state', value: 'idle' }],
  repairVerification: { dtcCleared: false, monitorStatus: 'supplied status', notes: 'supplied note' }
};

describe('AUT-250 lab assets — OBD-II scan tool', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('states explicitly that nothing is supplied before data arrives', () => {
    const scan = createScanTool({ mount: mount() });
    const text = scan.mount.textContent;
    expect(text).toMatch(/Vehicle information: not supplied/);
    expect(text).toMatch(/No trouble codes supplied/);
    expect(text).toMatch(/No freeze-frame data supplied/);
    expect(text).toMatch(/No live-data parameters supplied/);
    expect(text).toMatch(/No misfire counters supplied/);
    expect(text).toMatch(/No operating conditions supplied/);
    expect(text).toMatch(/Repair verification: not supplied/);
  });

  test('renders every supplied block and never assumes a verification outcome', () => {
    const scan = createScanTool({ mount: mount() });
    const result = scan.setData(PAYLOAD);
    expect(result.counts).toEqual({
      dtcs: 1, liveData: 1, misfireCounters: 1, operatingConditions: 1, repairVerificationSupplied: true
    });
    const text = scan.mount.textContent;
    expect(text).toMatch(/DEMO-1/);
    expect(text).toMatch(/Supplied description/);
    expect(text).toMatch(/Supplied speed/);
    expect(text).toMatch(/Supplied trim/);
    expect(text).toMatch(/Supplied cylinder 1/);
    expect(text).toMatch(/DTCs cleared \(supplied\)/);
    expect(text).toMatch(/no/);
  });

  test('omits verification fields the provider did not supply', () => {
    const scan = createScanTool({ mount: mount() });
    scan.setData({ repairVerification: {} });
    const text = scan.mount.textContent;
    expect(text).toMatch(/Repair verification was supplied without reportable fields/);
    expect(text).not.toMatch(/DTCs cleared/);
  });

  test('rejects malformed entries and reports why, without inventing content', () => {
    const scan = createScanTool({ mount: mount() });
    const normalized = normalizeScanToolPayload({
      dtcs: [{ description: 'no code' }, { code: 'DEMO-2' }],
      liveData: [{ label: 'no value' }],
      misfireCounters: [{ cylinder: 'c1', count: 'many' }],
      repairVerification: { dtcCleared: 'unspecified' }
    });
    expect(normalized.dtcs).toHaveLength(1);
    expect(normalized.liveData).toHaveLength(0);
    expect(normalized.misfireCounters).toHaveLength(0);
    expect(normalized.repairVerification.dtcCleared).toBeNull();
    expect(normalized.issues.length).toBeGreaterThanOrEqual(4);
    const result = scan.setData({ dtcs: [{ description: 'no code' }] });
    expect(scan.mount.textContent).toMatch(/a code string is required/);
    expect(result.issues.length).toBe(1);
  });

  test('clear returns every panel to an explicit not-supplied state', () => {
    const scan = createScanTool({ mount: mount() });
    scan.setData(PAYLOAD);
    expect(scan.mount.textContent).toMatch(/DEMO-1/);
    scan.clear();
    expect(scan.mount.textContent).toMatch(/No trouble codes supplied/);
    expect(scan.getState().repairVerificationSupplied).toBe(false);
  });
});
