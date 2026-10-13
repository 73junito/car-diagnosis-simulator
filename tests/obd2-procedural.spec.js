/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('procedural diagnostic workflow', () => {
  beforeEach(() => {
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  test('checklist renders for scenario', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const code = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: code}));

    window.initProceduralAssessment('no-start');
    const items = document.querySelectorAll('#procedural-step-list li');
    expect(items.length).toBeGreaterThan(0);
  });

  test('step completion toggles and completion state appears', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const code = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: code}));

    window.initProceduralAssessment('no-start');
    const checks = document.querySelectorAll('#procedural-step-list input[type=checkbox]');
    checks.forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); });
    // click check completion
    document.getElementById('procedural-check-complete').click();
    const state = document.getElementById('procedural-completion-state');
    expect(state.classList.contains('complete-pass') || state.classList.contains('complete-fail')).toBe(true);
  });

  test('safety acknowledgement required for hybrid-ev', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const code = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: code}));

    window.initProceduralAssessment('hybrid-ev');
    const checks = document.querySelectorAll('#procedural-step-list input[type=checkbox]');
    checks.forEach(cb => cb.checked = true);
    // without safety ack, completion should fail
    document.getElementById('procedural-check-complete').click();
    let state = document.getElementById('procedural-completion-state');
    expect(state.textContent).toMatch(/FAIL/);
    // now ack safety and re-check
    document.getElementById('procedural-safety-ack').checked = true;
    document.getElementById('procedural-check-complete').click();
    state = document.getElementById('procedural-completion-state');
    expect(state.textContent).toMatch(/PASS/);
  });

  test('direct page load initializes the procedural assessment exactly once without manual invocation', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const code = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-procedural.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: code}));

    // No manual invocation: selector and step list are populated by the script itself.
    const sel = document.getElementById('procedural-scenario-select');
    expect(Array.from(sel.options).map(o => o.value)).toEqual(['no-start','hybrid-ev']);
    expect(sel.value).toBe('no-start');
    expect(document.querySelectorAll('#procedural-step-list li').length).toBeGreaterThan(0);

    // Safety label stays hidden for the default non-HV scenario.
    const safetyLabel = document.getElementById('procedural-safety-label');
    expect(safetyLabel.classList.contains('hidden')).toBe(true);

    // Exactly one scenario-change handler is bound: one attempt load per change.
    const loads = [];
    window.attemptAdapter = { loadAttempt: (scenario) => { loads.push(scenario); return null; } };
    sel.value = 'hybrid-ev';
    sel.dispatchEvent(new Event('change'));
    expect(loads).toEqual(['hybrid-ev']);
    expect(safetyLabel.classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('#procedural-step-list li').length).toBeGreaterThan(0);

    // Manual re-invocation (test/tooling path) must not stack duplicate listeners.
    window.initProceduralAssessment('no-start');
    expect(document.getElementById('procedural-scenario-select').value).toBe('no-start');
    loads.length = 0;
    sel.value = 'hybrid-ev';
    sel.dispatchEvent(new Event('change'));
    expect(loads).toEqual(['hybrid-ev']);
    expect(safetyLabel.classList.contains('hidden')).toBe(false);
    delete window.attemptAdapter;
  });

});
