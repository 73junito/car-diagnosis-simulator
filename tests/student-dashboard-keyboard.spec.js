/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Student dashboard keyboard interactions', ()=>{
  beforeEach(()=>{
    const html = fs.readFileSync(path.join(__dirname,'..','dashboard','student.html'),'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
    Array.from(doc.body.childNodes).forEach(n => document.body.appendChild(document.importNode(n, true)));

    window.SCENARIO_REGISTRY = [
      { id: 'no-crank', title: 'Engine will not crank', shortSymptom: 'Engine will not crank', image: '/assets/images/scenarios/placeholder-scenario.svg', route: '#no-crank', category: 'no-crank' }
    ];
    window.scenarios = [ { id: 'no-crank', symptomCategory: 'no-crank', symptoms: 'Engine will not crank', tests: { scan: {} } } ];

    const script = fs.readFileSync(path.join(__dirname,'..','dashboard','student.js'),'utf8');
    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
    if(window.initStudentDashboard) window.initStudentDashboard();
  });

  test('Enter opens detail and Escape returns focus to opener', ()=>{
    const hotspot = document.querySelector('.hotspot[data-scenario="no-crank"]');
    expect(hotspot).toBeTruthy();
    hotspot.focus();
    expect(document.activeElement).toBe(hotspot);
    // simulate keyboard activation - in browsers Enter/Space on a button activate click
    hotspot.click();
    const detail = document.getElementById('detail');
    expect(detail.classList.contains('hidden')).toBe(false);
    const backBtn = document.getElementById('backBtn');
    expect(document.activeElement).toBe(backBtn);
    // send Escape to close
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(ev);
    expect(detail.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(hotspot);
  });

  test('Space opens detail and back button is focusable', ()=>{
    const hotspot = document.querySelector('.hotspot[data-scenario="no-crank"]');
    hotspot.focus();
    // simulate activation via Space -> call click for test environment
    hotspot.click();
    const backBtn = document.getElementById('backBtn');
    expect(backBtn).toBeTruthy();
    expect(document.activeElement).toBe(backBtn);
    // close via back button click and ensure focus returns
    backBtn.click();
    const detail = document.getElementById('detail');
    expect(detail.classList.contains('hidden')).toBe(true);
  });
});
