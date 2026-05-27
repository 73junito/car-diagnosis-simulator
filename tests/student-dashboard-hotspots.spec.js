/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Student dashboard hotspots', ()=>{
  beforeEach(()=>{
    // safely parse HTML into the jsdom document without using innerHTML
    const html = fs.readFileSync(path.join(__dirname,'..','dashboard','student.html'),'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
    Array.from(doc.body.childNodes).forEach(n => document.body.appendChild(document.importNode(n, true)));
    // minimal scenario list matching hotspot slugs
    window.scenarios = [
      { id:1, symptomCategory:'no-crank', slug:'no-crank', symptoms:'Engine will not crank', tests:{scan:{}} },
      { id:2, symptomCategory:'no-start', slug:'no-start', symptoms:'Engine cranks but will not start', tests:{scan:{}} }
    ];
    const script = fs.readFileSync(path.join(__dirname,'..','dashboard','student.js'),'utf8');
    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
    if(window.initStudentDashboard) window.initStudentDashboard();
  });

  test('hotspot click opens detail panel', ()=>{
    const hs = document.querySelector('.hs-1');
    expect(hs).toBeTruthy();
    hs.click();
    const detail = document.getElementById('detail');
    expect(detail.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('detailTitle').textContent).toMatch(/no-crank/);
  });
});
