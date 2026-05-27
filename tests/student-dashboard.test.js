/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Student dashboard', ()=>{
  beforeEach(()=>{
    // safely parse HTML into the jsdom document without using innerHTML
    const html = fs.readFileSync(path.join(__dirname,'..','dashboard','student.html'),'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
    Array.from(doc.body.childNodes).forEach(n => document.body.appendChild(document.importNode(n, true)));
    // simple mock scenarios
    window.scenarios = [ { id:1, symptomCategory:'no-crank', symptoms:'Engine will not crank', tests:{scan:{}} } ];
    // load the script and call init
    const script = fs.readFileSync(path.join(__dirname,'..','dashboard','student.js'),'utf8');
    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
    // init function attached to window
    if(window.initStudentDashboard) window.initStudentDashboard();
  });

  test('renders grid with at least one card', ()=>{
    const grid = document.getElementById('grid');
    expect(grid.children.length).toBeGreaterThan(0);
  });

  test('opens detail when clicking card', ()=>{
    const card = document.querySelector('.card');
    expect(card).toBeTruthy();
    card.click();
    const detail = document.getElementById('detail');
    expect(detail.classList.contains('hidden')).toBe(false);
    const title = document.getElementById('detailTitle');
    expect(title.textContent).toMatch(/no-crank|Engine/);
  });
});
