const { createMultimeter } = require('../../dashboard/student/aut250-lab-assets/src/multimeter');

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

describe('AUT-250 lab assets — virtual multimeter', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('shows an explicit not-supplied state and never a fabricated reading', () => {
    const dmm = createMultimeter({ mount: mount() });
    expect(dmm.mount.textContent).toMatch(/No measurement supplied/);
    expect(dmm.mount.textContent).toMatch(/not supplied/);
    expect(dmm.getState().measurement).toBeNull();
    expect(dmm.mount.textContent).not.toMatch(/\d+(\.\d+)?\s*(V|ohm|A)\b/);
  });

  test('displays a supplied voltage, its test point, and a keyboard-usable unit control', () => {
    const dmm = createMultimeter({ mount: mount() });
    const result = dmm.setMeasurement({
      id: 'v1', mode: 'dc-voltage', value: 12.62, unit: 'V', quality: 'demo',
      testPoint: { componentId: 'battery', terminalId: 'positive' }
    });
    expect(result.ok).toBe(true);
    expect(dmm.mount.textContent).toMatch(/12\.62 V/);
    expect(dmm.mount.textContent).toMatch(/battery · positive/);
    const select = dmm.mount.querySelector('select');
    expect(select.tagName).toBe('SELECT');
    expect(select.disabled).toBe(false);
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['V', 'mV']);
  });

  test('unit selection rescales supplied data and refuses incompatible units', () => {
    const dmm = createMultimeter({ mount: mount() });
    dmm.setMeasurement({ mode: 'dc-voltage', value: 12.62, unit: 'V' });
    expect(dmm.setDisplayUnit('mV').ok).toBe(true);
    expect(dmm.mount.textContent).toMatch(/12620 mV/);
    const refused = dmm.setDisplayUnit('ohm');
    expect(refused.ok).toBe(false);
    expect(refused.reason).toMatch(/Cannot convert/);
    expect(dmm.mount.textContent).toMatch(/12620 mV/);
  });

  test('reports continuity only when the provider supplies it', () => {
    const dmm = createMultimeter({ mount: mount() });
    dmm.setMeasurement({ mode: 'dc-voltage', value: 5, unit: 'V' });
    expect(dmm.mount.textContent).toMatch(/Continuity: not supplied/);
    dmm.setMeasurement({ mode: 'continuity', continuity: 'closed', resistanceOhm: 0.4 });
    expect(dmm.mount.textContent).toMatch(/CLOSED/);
    expect(dmm.mount.textContent).toMatch(/0\.4 ohm/);
    expect(dmm.mount.querySelector('select').disabled).toBe(true);
  });

  test('unsupported input is rejected with a reported reason and no substitute value', () => {
    const dmm = createMultimeter({ mount: mount() });
    const result = dmm.setMeasurement({ mode: 'capacitance', value: 1, unit: 'F' });
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatch(/Unsupported measurement mode/);
    expect(dmm.mount.textContent).toMatch(/No measurement supplied/);
    expect(dmm.getState().issues).toHaveLength(1);
  });

  test('clearing data returns to the not-supplied state and probes are deactivated', () => {
    const dmm = createMultimeter({ mount: mount() });
    dmm.setMeasurement({ mode: 'resistance', value: 0.8, unit: 'ohm' });
    expect(dmm.mount.querySelectorAll('.tm-lead--active')).toHaveLength(2);
    dmm.setMeasurement(null);
    expect(dmm.mount.querySelectorAll('.tm-lead--active')).toHaveLength(0);
    expect(dmm.mount.textContent).toMatch(/No measurement supplied/);
  });
});
