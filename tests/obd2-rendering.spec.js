/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('OBD2 dashboard rendering', () => {
  test('renders gauges and DTCs and switches scenario', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // move parsed body children into test DOM
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);

    // inject script
    const code = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.js'), 'utf8');
    const script = document.createElement('script'); script.textContent = code; document.head.appendChild(script);

    // provide fake scenarios
    window.scenarios = [
      { slug: 'demo', displayName: 'Demo', dtcs: ['P0335','P0300'], values: { rpm: 800, speed: 0, coolant: 185, voltage: 12.6 } },
      { slug: 'rough-idle', displayName: 'Rough Idle', dtcs: [], values: { rpm: 900, speed: 0, coolant: 180, voltage: 12.4 } }
    ];

    // initialize
    window.initObd2Dashboard('demo');

    expect(document.getElementById('gauge-rpm').textContent.trim()).toBe('800');
    expect(document.getElementById('gauge-voltage').textContent.trim()).toBe('12.6V');
    const dtcs = document.getElementById('dtc-list');
    expect(dtcs.children.length).toBeGreaterThanOrEqual(1);

    // switch scenario via select
    const sel = document.getElementById('scenario-select');
    sel.value = 'rough-idle';
    sel.dispatchEvent(new Event('change'));

    expect(document.getElementById('gauge-rpm').textContent.trim()).toBe('900');
    expect(document.getElementById('dtc-list').children.length).toBeGreaterThanOrEqual(1);
  });
});
