/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WL = path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs');
const ASSET_DIR = path.join(ROOT, 'dashboard', 'student', 'aut250-lab-assets', 'src');
const ASSET_FILES = [
  'data-contract.js', 'scenario-data.js', 'multimeter.js',
  'oscilloscope.js', 'scan-tool.js', 'vehicle-components.js'
];

function labId(week) {
  return 'aut250-lab-' + String(week).padStart(2, '0');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function loadRuntime() {
  const source = ASSET_FILES
    .map((file) => fs.readFileSync(path.join(ASSET_DIR, file), 'utf8'))
    .concat([fs.readFileSync(path.join(WL, 'src', 'lab-runtime.js'), 'utf8')])
    .join('\n;\n');
  new Function('window', 'document', source)(window, document);
  return window.Aut250WeeklyLabRuntime;
}

function render(week) {
  const runtime = loadRuntime();
  const host = document.createElement('div');
  document.body.append(host);
  const lab = readJson(path.join(WL, 'labs', labId(week), 'lab.json'));
  const api = runtime.createWeeklyLab({ mount: host, lab, assets: window.Aut250LabAssets });
  return { api, host, lab };
}

describe('AUT 250 weekly lab runtime', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.Aut250LabAssets;
    delete window.Aut250WeeklyLabRuntime;
  });

  test('Week 1 renders the full student lab with all three reusable instruments', () => {
    const { api, host } = render(1);
    const text = host.textContent;
    expect(text).toMatch(/Diagnostic safety and equipment familiarization/);
    expect(text).toMatch(/SIMULATED, DEVELOPMENTAL, FORMATIVE ONLY/);
    expect(text).toMatch(/Total 120 minutes/);
    expect(text).toMatch(/Equipment and asset status/);
    expect(text).toMatch(/Supplied measurements/);
    expect(text).toMatch(/Evidence worksheet/);
    expect(text).toMatch(/Repair verification plan/);
    expect(api.mountedInstruments).toHaveLength(3);
  });

  test('Week 1 shows the supplied reading as text with its provenance and limitations', () => {
    const { host } = render(1);
    expect(host.textContent).toMatch(/12\.62 V/);
    expect(host.textContent).toMatch(/illustrative/);
    expect(host.textContent).toMatch(/Not a measurement of any vehicle/);
  });

  test('qualitative waveform evidence is rendered as text with nothing plotted', () => {
    const { host } = render(1);
    expect(host.textContent).toMatch(/Qualitative descriptors only/);
    expect(host.textContent).toMatch(/No sampled trace is supplied or plotted/);
    expect(host.textContent).toMatch(/No waveform data supplied/);
  });

  test('every interactive control is a native, keyboard-reachable element', () => {
    const { host } = render(1);
    const testButtons = host.querySelectorAll('[data-test-id]');
    expect(testButtons.length).toBeGreaterThanOrEqual(2);
    testButtons.forEach((button) => expect(button.tagName).toBe('BUTTON'));
    testButtons[0].focus();
    expect(document.activeElement).toBe(testButtons[0]);

    host.querySelectorAll('textarea').forEach((field) => {
      expect(field.id).toBeTruthy();
      expect(host.querySelector('label[for="' + field.id + '"]')).not.toBeNull();
    });
    host.querySelectorAll('select').forEach((select) => {
      expect(select.id).toBeTruthy();
      expect(host.querySelector('label[for="' + select.id + '"]')).not.toBeNull();
    });
  });

  test('selecting a test updates pressed state and announces through the live region', () => {
    const { host } = render(1);
    const buttons = host.querySelectorAll('[data-test-id]');
    buttons[0].click();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    const status = host.querySelector('.wl-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch(/Test selected/);
  });

  test('the local summary contains no score and keeps every flag false', () => {
    const { host } = render(1);
    const build = Array.from(host.querySelectorAll('button'))
      .find((button) => button.textContent === 'Build local summary');
    build.click();
    const summary = host.querySelector('pre').textContent;
    expect(summary).toMatch(/"labId": "aut250-lab-01"/);
    expect(summary).toMatch(/"published": false/);
    expect(summary).toMatch(/"autoGradingEnabled": false/);
    expect(summary).not.toMatch(/score|grade|points|percent/i);
  });
});

describe('AUT 250 weekly lab runtime — weeks 2 to 4 and isolation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.Aut250LabAssets;
    delete window.Aut250WeeklyLabRuntime;
  });

  test('Week 2 discloses the unavailable service-information asset and mounts nothing', () => {
    const { api, host } = render(2);
    expect(host.textContent).toMatch(/Not available — no interaction is provided for this item/);
    expect(host.textContent).toMatch(/Developmental stand-in — limited, not a completed tool/);
    expect(api.mountedInstruments).toHaveLength(0);
    expect(host.textContent).toMatch(/No approved reusable instrument is available/);
  });

  test('Week 3 renders the illustrative retrieval context and asserts no code meaning', () => {
    const { host } = render(3);
    expect(host.textContent).toMatch(/Illustrative legacy manufacturer A/);
    expect(host.textContent).toMatch(/3 flashes, pause, 2 flashes/);
    expect(host.textContent).toMatch(/no asserted meaning/);
    expect(host.textContent).toMatch(/verified source/i);
  });

  test('Week 4 renders the placeholder scan payload without a real code definition', () => {
    const { api, host } = render(4);
    const text = host.textContent;
    expect(text).toMatch(/DEMO-DTC-A/);
    expect(text).toMatch(/Illustrative placeholder — not a real diagnostic trouble code definition/);
    expect(text).toMatch(/stored/);
    expect(text).toMatch(/pending/);
    expect(text).not.toMatch(/\b[PBCU]\d{4}\b/);
    expect(api.mountedInstruments.length).toBeGreaterThanOrEqual(1);
  });

  test('rendered output never contains instructor-only content', () => {
    [1, 2, 3, 4].forEach((week) => {
      document.body.innerHTML = '';
      const { host } = render(week);
      expect(host.textContent).not.toMatch(/expected evidence/i);
      expect(host.textContent).not.toMatch(/misconception/i);
      expect(host.textContent).not.toMatch(/acceptable alternative/i);
    });
  });

  test('the runtime refuses to render without a mount or a lab package', () => {
    const runtime = loadRuntime();
    expect(() => runtime.createWeeklyLab({ lab: readJson(path.join(WL, 'labs', labId(1), 'lab.json')) }))
      .toThrow(/mount element/);
    const host = document.createElement('div');
    expect(() => runtime.createWeeklyLab({ mount: host })).toThrow(/lab package/);
  });

  test('clearing entries removes local input and reports that nothing was stored', () => {
    const { host } = render(1);
    const buttons = Array.from(host.querySelectorAll('button'));
    const testButton = host.querySelector('[data-test-id]');
    testButton.click();
    expect(testButton.getAttribute('aria-pressed')).toBe('true');

    buttons.find((button) => button.textContent === 'Clear my entries').click();
    expect(testButton.getAttribute('aria-pressed')).toBe('false');
    const status = host.querySelector('.wl-status');
    expect(status.textContent).toMatch(/Nothing was stored/);
  });
});

