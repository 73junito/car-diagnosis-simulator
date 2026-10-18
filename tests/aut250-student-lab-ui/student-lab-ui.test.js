/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'dashboard', 'student', 'aut250-lab-ui');

function loadLab() {
  const adapterSrc = fs.readFileSync(path.join(UI, 'aut250-mock-adapter.js'), 'utf8');
  const labSrc = fs.readFileSync(path.join(UI, 'aut250-lab.js'), 'utf8');
  document.body.innerHTML = fs.readFileSync(path.join(UI, 'index.html'), 'utf8');
  const run = new Function('window', 'document', `${adapterSrc};\n${labSrc}`);
  run(window, document);
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
}

describe('AUT-250 student lab UI components (simulated)', () => {
  beforeEach(() => { jest.resetModules(); document.body.innerHTML = ''; });
  afterEach(() => { delete window.Aut250MockAdapter; delete window.Aut250StudentLab; });

  test('workstation exposes simulated instruments, keyboard-focusable controls, and live status', () => {
    loadLab();
    expect(document.getElementById('labMain')).not.toBeNull();
    expect(document.getElementById('statusMessage').getAttribute('aria-live')).toBe('polite');
    expect(document.querySelectorAll('[data-test]').length).toBeGreaterThan(4);
    expect(document.getElementById('scopeCanvas')).not.toBeNull();
    expect(document.getElementById('hypothesis')).not.toBeNull();
    expect(document.getElementById('repairList').children.length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/SIMULATED/);
  });

  test('selecting a simulated test updates the DMM and status message', () => {
    loadLab();
    document.querySelector('[data-test=\"coil-secondary-resistance\"]').click();
    expect(document.getElementById('dmmDisplay').textContent).toContain('OL');
    expect(document.getElementById('statusMessage').textContent).toMatch(/recorded/);
  });

  test('exporting evidence stays local and is labeled simulated', () => {
    loadLab();
    document.getElementById('exportBtn').click();
    expect(document.getElementById('evidencePreview').textContent).toMatch(/simulated/i);
    expect(document.getElementById('statusMessage').textContent).toMatch(/Not for assessment/);
  });
});
