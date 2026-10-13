/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

// Direct-load regression coverage for dashboard/obd2-student.js: the page
// script must initialize the workflow itself on a normal page load, exactly
// once, without any manual invocation of window.initObd2StudentWorkflow().
// Kept in a dedicated file so the counters below observe a single script
// instance (each Jest file gets a fresh document).
describe('OBD2 student workflow direct-load initialization', () => {
  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  function loadPage({ search = '' } = {}) {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2-student.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    while (doc.body.firstChild) document.body.appendChild(doc.body.firstChild);

    // Production-like ordering: scenario data globals exist before the page script runs.
    window.scenarios = [ { slug: 'demo', displayName: 'Demo' }, { slug: 'other', displayName: 'Other' } ];
    window.testsAvailable = [ 'OBD Scan', 'Battery Test' ];

    window.history.pushState({}, '', '/dashboard/obd2-student.html' + search);
    const code = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2-student.js'), 'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'), { textContent: code }));
  }

  afterEach(() => {
    window.history.pushState({}, '', '/dashboard/obd2-student.html');
    delete window.attemptAdapter;
  });

  test('initializes the workflow exactly once without manual invocation', () => {
    loadPage();

    // No manual invocation: selector and checklist are populated by the script itself.
    const sel = document.getElementById('scenario-select');
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(['demo', 'other']);
    expect(sel.value).toBe('demo');
    const checklist = document.getElementById('test-checklist');
    expect(checklist.querySelectorAll('input[type=checkbox]').length).toBe(2);

    const loads = [];
    const saves = [];
    window.attemptAdapter = {
      loadAttempt: (scenario) => { loads.push(scenario); return null; },
      saveAttempt: (scenario) => { saves.push(scenario); },
    };

    // Exactly one scenario-change handler is bound: one attempt load per change.
    sel.value = 'other';
    sel.dispatchEvent(new Event('change'));
    expect(loads).toEqual(['other']);

    // Exactly one checklist-change handler is bound: one persistence write per
    // change (bubbles: native change events bubble to the document listener).
    const cb = checklist.querySelector('input[type=checkbox]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(saves).toEqual(['other']);

    // Manual re-invocation (test/tooling path) must not stack duplicate listeners.
    window.initObd2StudentWorkflow('demo');
    expect(document.getElementById('scenario-select').value).toBe('demo');
    loads.length = 0;
    saves.length = 0;
    sel.value = 'other';
    sel.dispatchEvent(new Event('change'));
    const cb2 = checklist.querySelector('input[type=checkbox]');
    cb2.checked = true;
    cb2.dispatchEvent(new Event('change', { bubbles: true }));
    expect(loads).toEqual(['other']);
    expect(saves).toEqual(['other']);
  });

  test('honors the scenario query parameter on direct load', () => {
    loadPage({ search: '?scenario=other' });
    // The query-selected scenario is resolved by the existing init logic.
    expect(document.getElementById('scenario-select').value).toBe('other');
    expect(document.querySelectorAll('#test-checklist input[type=checkbox]').length).toBe(2);
  });
});
