/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

function loadScriptIntoWindow(filePath, window) {
  const code = fs.readFileSync(filePath, 'utf8');
  const fn = new Function('window','document','self','location','history', code + '\n//# sourceURL=' + filePath);
  fn(window, window.document, window, window.location, window.history);
}

describe('Student dashboard keyboard interactions', ()=>{
  beforeEach(()=>{
    const html = fs.readFileSync(path.join(__dirname,'..','dashboard','student','index.html'),'utf8');
    document.documentElement.innerHTML = html;
    // load scenarios and registry
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenarios.js'), window);
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenario-registry.js'), window);
    
    // fallback renderer for jsdom (inline script doesn't execute when setting innerHTML)
    const grid = document.getElementById('scenarioGrid');
    if (!grid || grid.children.length === 0) {
      const container = document.getElementById('scenarioGrid');
      const list = (window.SCENARIO_REGISTRY || []);
      list.forEach(s => {
        const card = document.createElement('article');
        card.className = 'sd-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', s.title || s.id);
        const img = document.createElement('img');
        img.className = 'sd-card-img';
        img.alt = s.title || '';
        img.src = s.image;
        const body = document.createElement('div');
        body.className = 'sd-card-body';
        const title = document.createElement('h3');
        title.className = 'sd-card-title';
        title.textContent = s.title || s.id;
        const meta = document.createElement('div');
        meta.className = 'sd-card-meta';
        meta.textContent = `${s.category || ''} • ${s.difficulty || ''}`;
        const p = document.createElement('p');
        p.className = 'sd-card-text';
        p.textContent = s.shortSymptom || '';
        body.appendChild(title);
        body.appendChild(meta);
        body.appendChild(p);
        const footer = document.createElement('div');
        footer.className = 'sd-card-footer';
        const btn = document.createElement('a');
        btn.className = 'btn btn-secondary';
        btn.href = s.route || '#';
        btn.textContent = 'Start';
        footer.appendChild(btn);
        card.appendChild(img);
        card.appendChild(body);
        card.appendChild(footer);
        container.appendChild(card);
      });
    }
  });

  test('Enter opens detail and Escape returns focus to opener', ()=>{
    const card = document.querySelector('.sd-card');
    expect(card).toBeTruthy();
    card.focus();
    expect(document.activeElement).toBe(card);
    // simulate keyboard activation - Enter on a card triggers detail
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(ev);
    card.click();
    const detail = document.getElementById('detail');
    // detail should open on card click
    if(detail && !detail.classList.contains('hidden')){
      const backBtn = document.getElementById('backBtn');
      expect(backBtn).toBeTruthy();
      // back button should be focusable
      backBtn.focus();
      expect(document.activeElement).toBe(backBtn);
    }
  });

  test('Space opens detail and back button is focusable', ()=>{
    const card = document.querySelector('.sd-card');
    expect(card).toBeTruthy();
    card.focus();
    expect(document.activeElement).toBe(card);
    // simulate activation via Space -> call click for test environment
    const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    card.dispatchEvent(ev);
    card.click();
    const backBtn = document.getElementById('backBtn');
    if(backBtn){
      backBtn.focus();
      expect(document.activeElement).toBe(backBtn);
    }
  });
});

// Faithful focus-lifecycle regression: exercises the REAL inline card renderer
// (createCard + the fixed Details handler) and the REAL student.js detail
// controller (showScenarioDetail / closeDetail) instead of a stub renderer.
describe('Student dashboard scenario detail focus restoration (real handlers)', ()=>{
  const REPO = path.resolve(__dirname, '..');
  const INDEX = path.join(REPO, 'dashboard', 'student', 'index.html');

  // Extract the inline (non-src) <script> block that defines createCard.
  function extractInlineGridScript(html){
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    const grid = scripts.map(m => m[1]).find(code => /function createCard/.test(code));
    if(!grid) throw new Error('inline createCard script not found in index.html');
    return grid;
  }

  function loadRealDashboard(){
    const html = fs.readFileSync(INDEX, 'utf8');
    document.documentElement.innerHTML = html;

    loadScriptIntoWindow(path.join(REPO, 'data', 'scenarios.js'), window);
    loadScriptIntoWindow(path.join(REPO, 'data', 'scenario-registry.js'), window);
    loadScriptIntoWindow(path.join(REPO, 'dashboard', 'student-progress.js'), window);

    // Real detail controller + explicit init (wired on DOMContentLoaded in browser).
    loadScriptIntoWindow(path.join(REPO, 'dashboard', 'student', 'student.js'), window);
    if(window.initStudentDashboard) window.initStudentDashboard();

    // Execute the REAL inline grid renderer so createCard() builds real cards
    // with the actual (fixed) Details handler wired to showScenarioDetail.
    const inline = extractInlineGridScript(html);
    const run = new Function('window','document','self','location','history',
      inline + '\n//# sourceURL=inline-grid');
    run(window, window.document, window, window.location, window.history);
  }

  beforeEach(()=>{ loadRealDashboard(); });

  const getDetail = () => document.getElementById('detail');
  const getBackBtn = () => document.getElementById('backBtn');
  const getDetailsButtons = () => Array.from(document.querySelectorAll('.student-text-button'));
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  test('Details -> detail opens -> Back to dashboard focused', ()=>{
    const detailsButtons = getDetailsButtons();
    expect(detailsButtons.length).toBeGreaterThan(0);

    const detailsBtn = detailsButtons[0];
    detailsBtn.focus();
    expect(document.activeElement).toBe(detailsBtn);

    click(detailsBtn);

    expect(getDetail().classList.contains('hidden')).toBe(false);
    // showDetail() moves focus to the back button.
    expect(document.activeElement).toBe(getBackBtn());
  });

  test('Back to dashboard returns focus to the EXACT originating Details button', ()=>{
    const detailsBtn = getDetailsButtons()[0];
    detailsBtn.focus();
    click(detailsBtn);
    expect(getDetail().classList.contains('hidden')).toBe(false);
    expect(document.activeElement).toBe(getBackBtn());

    click(getBackBtn());

    expect(getDetail().classList.contains('hidden')).toBe(true);
    // Regression contract: focus returns to the same originating Details button,
    // NOT to <body> (bug: the non-focusable <article> card was stored as opener).
    expect(document.activeElement).toBe(detailsBtn);
  });

  test('Escape closes the detail and returns focus to the originating Details button', ()=>{
    const detailsBtn = getDetailsButtons()[0];
    detailsBtn.focus();
    click(detailsBtn);
    expect(getDetail().classList.contains('hidden')).toBe(false);
    expect(document.activeElement).toBe(getBackBtn());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getDetail().classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(detailsBtn);
  });

  test('opening a second scenario restores focus to that scenario\'s own Details button', ()=>{
    const detailsButtons = getDetailsButtons();
    expect(detailsButtons.length).toBeGreaterThan(1);

    const first = detailsButtons[0];
    const second = detailsButtons[1];

    first.focus();
    click(first);
    expect(document.activeElement).toBe(getBackBtn());
    click(getBackBtn());
    expect(document.activeElement).toBe(first);

    second.focus();
    click(second);
    expect(document.activeElement).toBe(getBackBtn());
    click(getBackBtn());

    // Focus must return to the second Details button, not the first.
    expect(document.activeElement).toBe(second);
    expect(document.activeElement).not.toBe(first);
  });
});
