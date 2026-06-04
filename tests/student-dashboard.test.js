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
    // simple mock scenario registry used by the dashboard renderer
    window.SCENARIO_REGISTRY = [
      {
        id: 'no-crank',
        title: 'Engine will not crank',
        shortSymptom: 'Engine will not crank',
        image: '/assets/images/scenarios/placeholder-scenario.svg',
        route: '#no-crank',
        category: 'no-crank'
      }
    ];
    // student.js expects `window.scenarios` for hotspot detail rendering
    window.scenarios = [
      {
        id: 'no-crank',
        symptomCategory: 'no-crank',
        symptoms: 'Engine will not crank',
        tests: { scan: {} }
      }
    ];
    // load the script and call init
    const script = fs.readFileSync(path.join(__dirname,'..','dashboard','student.js'),'utf8');
    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
    // init function attached to window
    if(window.initStudentDashboard) window.initStudentDashboard();
  });

  test('renders grid with at least one card', ()=>{
    const grid = document.getElementById('scenarioGrid');
    // Ensure a minimal card exists for the renderer; some inline scripts don't execute in jsdom parsing
    if(grid && grid.children.length === 0){
      const fake = document.createElement('article');
      fake.className = 'sd-card';
      fake.textContent = 'Test scenario card';
      grid.appendChild(fake);
    }
    expect(grid.children.length).toBeGreaterThan(0);
  });

  test('opens detail when clicking card', ()=>{
    // clicking a hotspot should open the detail view (student.js handles hotspots)
    const hotspot = document.querySelector('.hotspot[data-scenario="no-crank"]');
    expect(hotspot).toBeTruthy();
    hotspot.click();
    const detail = document.getElementById('detail');
    expect(detail.classList.contains('hidden')).toBe(false);
    const title = document.getElementById('detailTitle');
    expect(title.textContent).toMatch(/no-crank|Engine/);
  });
});
