/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('OBD2 student diagnostic workflow', () => {
  test('renders workflow, allows test selection, entering diagnosis, and submit shows feedback; scenario switch resets', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2-student.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    while(doc.body.firstChild) document.body.appendChild(doc.body.firstChild);

    const code = fs.readFileSync(path.resolve(process.cwd(), 'dashboard/obd2-student.js'), 'utf8');
    const script = document.createElement('script'); script.textContent = code; document.head.appendChild(script);

    // provide scenarios and tests
    window.scenarios = [ { slug: 'demo', displayName: 'Demo' }, { slug: 'other', displayName: 'Other' } ];
    window.testsAvailable = ['OBD Scan','Battery Test','Compression Test'];

    window.initObd2StudentWorkflow('demo');

    // checklist should render
    const checklist = document.getElementById('test-checklist');
    expect(checklist.children.length).toBeGreaterThanOrEqual(3);

    // select a test
    const firstCb = checklist.querySelector('input[type=checkbox]');
    firstCb.checked = true; firstCb.dispatchEvent(new Event('change'));
    expect(firstCb.checked).toBe(true);

    // enter diagnosis and submit
    const diag = document.getElementById('diagnosis-input'); diag.value = 'Faulty sensor'; diag.dispatchEvent(new Event('input'));
    const submit = document.getElementById('submit-diagnosis'); submit.dispatchEvent(new Event('click'));
    const feedback = document.getElementById('diagnosis-feedback');
    expect(feedback.textContent).toMatch(/Diagnosis submitted/);

    // switch scenario resets state
    const sel = document.getElementById('scenario-select'); sel.value = 'other'; sel.dispatchEvent(new Event('change'));
    expect(document.getElementById('diagnosis-input').value).toBe('');
    expect(document.querySelectorAll('#test-checklist input[type=checkbox]:checked').length).toBe(0);
    expect(document.getElementById('diagnosis-feedback').textContent).toMatch(/No submission yet/);
  });
});
