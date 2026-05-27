/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Attempt store scaffold', () => {
  beforeEach(() => {
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  test('student save and restore state', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-student.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    // load scripts
    const storeCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-store.js'),'utf8');
    const studentCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-student.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: storeCode}));
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: studentCode}));

    window.scenarios = [{slug:'no-start', displayName:'No Start'}];
    window.initObd2StudentWorkflow('no-start');
    document.getElementById('symptom-text').value = 'no crank';
    const cbs = document.querySelectorAll('#test-checklist input[type=checkbox]'); cbs[0].checked = true; cbs[0].dispatchEvent(new Event('change'));
    document.getElementById('diagnosis-input').value = 'starter fault';
    // trigger save via submit
    document.getElementById('submit-diagnosis').click();

    const saved = window.attemptStore.loadAttempt('no-start');
    expect(saved).not.toBeNull();
    expect(saved.symptoms).toBe('no crank');
    expect(saved.diagnosis).toBe('starter fault');

    // clear UI and restore
    window._obd2Student.resetWorkflow();
    expect(document.getElementById('symptom-text').value).toBe('');
    window._obd2Student.loadAttemptState('no-start');
    expect(document.getElementById('symptom-text').value).toBe('no crank');
  });

  test('ASE save, restore and reset', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-ase.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const storeCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-store.js'),'utf8');
    const aseCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-ase.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: storeCode}));
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: aseCode}));

    window.initAseAssessment('no-start');
    const checks = document.querySelectorAll('#ase-step-list input[type=checkbox]');
    checks[0].checked = true; checks[0].dispatchEvent(new Event('change'));
    document.getElementById('ase-check-complete').click();
    const saved = window.attemptStore.loadAttempt('no-start');
    expect(saved).not.toBeNull();
    expect(Array.isArray(saved.steps)).toBe(true);

    // reset and ensure cleared
    window.attemptStore.resetAttempt('no-start');
    expect(window.attemptStore.loadAttempt('no-start')).toBeNull();
  });

  test('scenario switch resets incompatible attempt data', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-student.html'),'utf8');
    const doc = new DOMParser().parseFromString(html,'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);
    const storeCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-store.js'),'utf8');
    const studentCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/obd2-student.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: storeCode}));
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: studentCode}));

    window.scenarios = [{slug:'no-start', displayName:'No Start'},{slug:'hybrid-ev', displayName:'Hybrid EV'}];
    window.initObd2StudentWorkflow('no-start');
    document.getElementById('symptom-text').value = 'no crank';
    document.getElementById('submit-diagnosis').click();
    // saved under no-start
    expect(window.attemptStore.loadAttempt('no-start')).not.toBeNull();
    // switch scenario - UI should reset and not load no-start data
    const sel = document.getElementById('scenario-select'); sel.value='hybrid-ev'; sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('symptom-text').value).toBe('');
  });

});
