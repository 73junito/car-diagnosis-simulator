/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Student dashboard hotspots', ()=>{
  beforeEach(()=>{
    document.body.innerHTML = fs.readFileSync(path.join(__dirname,'..','dashboard','student.html'),'utf8');
    // minimal scenario list matching hotspot slugs
    window.scenarios = [
      { id:1, symptomCategory:'no-crank', slug:'no-crank', symptoms:'Engine will not crank', tests:{scan:{}} },
      { id:2, symptomCategory:'no-start', slug:'no-start', symptoms:'Engine cranks but will not start', tests:{scan:{}} }
    ];
    const script = fs.readFileSync(path.join(__dirname,'..','dashboard','student.js'),'utf8');
    eval(script);
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
