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

});
