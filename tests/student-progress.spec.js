/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

function loadScriptIntoWindow(filePath, window) {
  const code = fs.readFileSync(filePath, 'utf8');
   
  const fn = new Function('window','document','self','location','history', code + '\n//# sourceURL=' + filePath);
  fn(window, window.document, window, window.location, window.history);
}

// Minimal test renderer that uses studentProgress API
function renderForTests(){
  function createCard(s){
    const card = document.createElement('article'); card.className = 'sd-card';
    card.tabIndex = 0; card.setAttribute('role','button'); card.setAttribute('aria-label', s.title || s.id);
    const body = document.createElement('div'); body.className = 'sd-card-body';
    const title = document.createElement('h3'); title.className = 'sd-card-title'; title.textContent = s.title || s.id;
    const footer = document.createElement('div'); footer.className = 'sd-card-footer';
    const btn = document.createElement('a'); btn.className = 'btn btn-secondary'; btn.href = s.route || '#'; btn.textContent = 'Start';
    const badge = document.createElement('span'); badge.className = 'sd-badge badge--status';
    const progressEntry = window.studentProgress.getProgressFor(s.id);
    badge.textContent = progressEntry && progressEntry.status ? progressEntry.status : 'not-started';
    footer.appendChild(badge); footer.appendChild(btn);
    card.appendChild(body); body.appendChild(title); card.appendChild(footer);
    card.addEventListener('click', ()=>{ window.studentProgress.setLastScenario(s.id); window.studentProgress.setProgressFor(s.id,'in-progress'); window.location.hash = btn.getAttribute('href'); });
    card.addEventListener('keydown',(e)=>{ if(e.key==='Enter' || e.key===' ') { window.studentProgress.setLastScenario(s.id); window.studentProgress.setProgressFor(s.id,'in-progress'); window.location.hash = btn.getAttribute('href'); } });
    return card;
  }

  const container = document.getElementById('scenarioGrid'); while(container.firstChild){ container.removeChild(container.firstChild); }
  const registry = (window.SCENARIO_REGISTRY||[]).slice(0,17);
  registry.forEach(s => container.appendChild(createCard(s)));
  // update summary
  const progress = window.studentProgress.loadProgress();
  const completed = Object.values(progress).filter(p=>p.status==='completed').length;
  const inProgress = Object.values(progress).filter(p=>p.status==='in-progress').length;
  document.getElementById('progressSummary').textContent = `Completed: ${completed} / ${registry.length} • In Progress: ${inProgress}`;
  // resume & reset buttons behavior (minimal)
  const resumeBtn = document.getElementById('btnResume');
  const resetBtn = document.getElementById('btnReset');
  if(resumeBtn){ const last = window.studentProgress.getLastScenario(); if(last && last.id){ resumeBtn.style.display='inline-block'; resumeBtn.dataset.scenario = last.id; } else { resumeBtn.style.display='none'; } }
  if(resetBtn){ resetBtn.onclick = ()=>{ const ok = window.confirm('Reset all progress? This cannot be undone.'); if(!ok) return; window.studentProgress.clearProgress(); renderForTests(); }; }
}

describe('Student progress persistence and UI', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, '../dashboard/student.html'), 'utf8');
     
    document.documentElement.innerHTML = html;
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenarios.js'), window);
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenario-registry.js'), window);
    loadScriptIntoWindow(path.resolve(__dirname, '../dashboard/student-progress.js'), window);
    // ensure clean storage
    localStorage.clear();
  });

  test('empty localStorage initialization', () => {
    const p = window.studentProgress.loadProgress();
    expect(p).toEqual({});
    expect(window.studentProgress.getLastScenario()).toBeNull();
  });

  test('storage write/read', () => {
    window.studentProgress.setProgressFor('no-crank','in-progress');
    const p = window.studentProgress.loadProgress();
    expect(p['no-crank'].status).toBe('in-progress');
    expect(typeof p['no-crank'].updated).toBe('string');
  });

  test('resume button visibility', () => {
    // set last scenario and render
    window.studentProgress.setLastScenario('no-crank');
    renderForTests();
    const btn = document.getElementById('btnResume');
    expect(btn).toBeTruthy();
    expect(btn.style.display).not.toBe('none');
  });

  test('clicking scenario updates last_scenario and progress entry', () => {
    renderForTests();
    const first = document.querySelector('.sd-card');
    first.click();
    const last = window.studentProgress.getLastScenario();
    expect(last && last.id).toBeTruthy();
    const p = window.studentProgress.getProgressFor(last.id);
    expect(p.status).toBe('in-progress');
  });

  test('reset behavior clears storage and rerenders', () => {
    // set progress and last
    window.studentProgress.setProgressFor('no-crank','completed');
    window.studentProgress.setLastScenario('no-crank');
    renderForTests();
    // mock confirm
    window.confirm = () => true;
    // simulate reset
    const resetBtn = document.getElementById('btnReset');
    expect(resetBtn).toBeTruthy();
    resetBtn.click();
    // after reset, storage should be cleared
    expect(window.studentProgress.loadProgress()).toEqual({});
    expect(window.studentProgress.getLastScenario()).toBeNull();
  });

  test('badge rendering and progress summary counts', () => {
    window.studentProgress.setProgressFor('no-crank','completed');
    window.studentProgress.setProgressFor('no-start','in-progress');
    renderForTests();
    const badges = Array.from(document.querySelectorAll('.sd-badge')).map(n=>n.textContent);
    expect(badges).toContain('completed');
    expect(badges).toContain('in-progress');
    expect(document.getElementById('progressSummary').textContent).toMatch(/Completed: 1 \/ 17/);
  });

  test('corrupted localStorage recovery', () => {
    localStorage.setItem('student_progress','not-a-json');
    expect(() => window.studentProgress.loadProgress()).not.toThrow();
    expect(window.studentProgress.loadProgress()).toEqual({});
  });
});
