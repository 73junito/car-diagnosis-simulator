/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('OBD2 live scan and freeze-frame', () => {
  test('live emit and freeze-frame add/show', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);

    const code = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2.js'), 'utf8');
    const script = document.createElement('script'); script.textContent = code; document.head.appendChild(script);

    // basic init
    window.scenarios = [ { slug: 'demo', displayName:'Demo' } ];
    window.initObd2Dashboard('demo');

    // emit a live frame synchronously
    window._obd2Live.emitLiveFrame();
    const live = document.getElementById('live-list');
    expect(live.children.length).toBeGreaterThanOrEqual(1);

    // add freeze frame and show detail
    const frame = { id: 'ff1', label: 'FF1', desc: 'freeze data' };
    window._obd2Live.addFreezeFrame(frame);
    const freeze = document.getElementById('freeze-list');
    expect(freeze.children.length).toBeGreaterThanOrEqual(1);

    // simulate clicking the freeze frame
    freeze.children[0].dispatchEvent(new Event('click'));
    expect(document.getElementById('freeze-desc').textContent).toContain('freeze');
  });
});
