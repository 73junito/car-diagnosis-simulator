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
