/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('OBD2 gauges and DTC detail panel', () => {
  test('renders animated gauges, updates on scenario switch, shows DTC detail', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);

    const code = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.js'), 'utf8');
    const script = document.createElement('script'); script.textContent = code; document.head.appendChild(script);

    window.scenarios = [
      { slug: 'no-start', displayName: 'No Start', dtcs: ['P0335'], values: { rpm: 0, speed: 0, coolant: 190, voltage: 12.5 } },
      { slug: 'overheating', displayName: 'Overheating', dtcs: ['P0420'], values: { rpm: 700, speed: 0, coolant: 250, voltage: 12.3 } },
      { slug: 'charging-system', displayName: 'Charging', dtcs: ['P0300'], values: { rpm: 900, speed: 0, coolant: 180, voltage: 14.2 } }
    ];

    window.initObd2Dashboard('no-start');

    // initial values loaded
    expect(document.getElementById('gauge-coolant').querySelector('.g-value').textContent).toBe('190°F');
    expect(document.getElementById('gauge-voltage').querySelector('.g-value').textContent).toBe('12.5V');

    // switch to overheating
    const sel = document.getElementById('scenario-select');
    sel.value = 'overheating';
    sel.dispatchEvent(new Event('change'));

    expect(document.getElementById('gauge-coolant').querySelector('.g-value').textContent).toBe('250°F');

    // click DTC and assert detail panel updates
    const dtcItem = Array.from(document.getElementById('dtc-list').children).find(li => li.dataset.code === 'P0420');
    expect(dtcItem).toBeDefined();
    dtcItem.click();
    expect(document.getElementById('dtc-detail-code').textContent).toBe('P0420');
    expect(document.getElementById('dtc-detail-desc').textContent.length).toBeGreaterThan(0);
  });
});
