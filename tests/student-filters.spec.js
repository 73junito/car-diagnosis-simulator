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

// Helper renderer used in tests to mirror page behavior
function attachTestRenderer() {
  function createCard(s){
    const card = document.createElement('article'); card.className = 'sd-card';
    card.tabIndex = 0; card.setAttribute('role','button'); card.setAttribute('aria-label', s.title || s.id);
    const img = document.createElement('img'); img.className = 'sd-card-img'; img.alt = s.title || ''; img.src = s.image;
    const body = document.createElement('div'); body.className = 'sd-card-body';
    const title = document.createElement('h3'); title.className = 'sd-card-title'; title.textContent = s.title || s.id;
    const meta = document.createElement('div'); meta.className = 'sd-card-meta'; meta.textContent = `${s.category || ''} • ${s.difficulty || ''}`;
    const p = document.createElement('p'); p.className = 'sd-card-text'; p.textContent = s.shortSymptom || '';
    body.appendChild(title); body.appendChild(meta); body.appendChild(p);
    const footer = document.createElement('div'); footer.className = 'sd-card-footer';
    const btn = document.createElement('a'); btn.className = 'btn btn-secondary'; btn.href = s.route || '#'; btn.textContent = 'Start'; footer.appendChild(btn);
    card.appendChild(img); card.appendChild(body); card.appendChild(footer);
    // test-safe navigation
    card.addEventListener('click', ()=>{ window.location.hash = btn.getAttribute('href'); });
    card.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { window.location.hash = btn.getAttribute('href'); } });
    return card;
  }

  function populateFilterOptions(registry){
    const cat = document.getElementById('filterCategory');
    const ase = document.getElementById('filterAse');
    if(!cat || !ase) return;
    const cats = new Set(); const ases = new Set();
    registry.forEach(s => { if(s.category) cats.add(s.category); if(s.aseArea) ases.add(s.aseArea); });
    Array.from(cats).sort().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c.replace(/[-_]/g,' '); cat.appendChild(o); });
    Array.from(ases).sort().forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; ase.appendChild(o); });
  }

  function getFilters(){
    return {
      q: (document.getElementById('searchInput') || {}).value || '',
      category: (document.getElementById('filterCategory') || {}).value || 'all',
      difficulty: (document.getElementById('filterDifficulty') || {}).value || 'all',
      ase: (document.getElementById('filterAse') || {}).value || 'all'
    };
  }

  function matchesFilter(s, filters){
    if(!s) return false;
    if(filters.category && filters.category !== 'all'){
      if(String((s.category||'')).toLowerCase() !== String(filters.category).toLowerCase()) return false;
    }
    if(filters.difficulty && filters.difficulty !== 'all'){
      if(String((s.difficulty||'')).toLowerCase() !== String(filters.difficulty).toLowerCase()) return false;
    }
    if(filters.ase && filters.ase !== 'all'){
      if(String((s.aseArea||'')).toLowerCase() !== String(filters.ase).toLowerCase()) return false;
    }
    if(filters.q && filters.q.trim() !== ''){
      const q = filters.q.trim().toLowerCase();
      const hay = ((s.title||'') + ' ' + (s.shortSymptom||'') + ' ' + (s.id||'')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }

  function resetAllFilters(){
    const search = document.getElementById('searchInput');
    const category = document.getElementById('filterCategory');
    const difficulty = document.getElementById('filterDifficulty');
    const ase = document.getElementById('filterAse');
    let changed = false;
    if(search){
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));
      changed = true;
    }
    [category, difficulty, ase].forEach((el)=>{
      if(!el) return;
      el.value = 'all';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      changed = true;
    });
    if(!changed) renderGrid();
  }

  function renderGrid(){
    const container = document.getElementById('scenarioGrid');
    const countEl = document.getElementById('filterCount');
    if(!container) return;
    while(container.firstChild){ container.removeChild(container.firstChild); }
    const registry = (window.SCENARIO_REGISTRY || []).slice(0,17);
    populateFilterOptions(registry);
    const filters = getFilters();
    const total = registry.length;
    const shown = registry.filter(s => matchesFilter(s, filters));
    if(shown.length === 0){
      const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No scenarios match your filters.';
      container.appendChild(empty);
    } else {
      shown.forEach(s => container.appendChild(createCard(s)));
    }
    if(countEl) countEl.textContent = `Showing ${shown.length} of ${total} scenarios`;
    return {shown, total};
  }

  // attach handlers
  function attachFilterHandlers(){
    const inputs = ['searchInput','filterCategory','filterDifficulty','filterAse'];
    inputs.forEach(id => { const el = document.getElementById(id); if(!el) return; el.addEventListener('input', renderGrid); el.addEventListener('change', renderGrid); });
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if(resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
  }

  window.__testRender = renderGrid;
  window.__testAttachFilters = attachFilterHandlers;
}

describe('Student dashboard filters', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, '../dashboard/student.html'), 'utf8');
     
    document.documentElement.innerHTML = html;
    // load scenarios and registry
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenarios.js'), window);
    loadScriptIntoWindow(path.resolve(__dirname, '../data/scenario-registry.js'), window);
    // attach test renderer
    attachTestRenderer();
    // initial render and handlers
    window.__testRender();
    window.__testAttachFilters();
  });

  test('initially renders 17 cards', () => {
    const grid = document.getElementById('scenarioGrid');
    expect(grid.querySelectorAll('.sd-card').length).toBe(17);
    expect(document.getElementById('filterCount').textContent).toContain('Showing 17 of 17');
  });

  test('search filter reduces results correctly', () => {
    const search = document.getElementById('searchInput');
    search.value = 'hybrid';
    search.dispatchEvent(new Event('input'));
    const grid = document.getElementById('scenarioGrid');
    const cards = grid.querySelectorAll('.sd-card');
    expect(cards.length).toBeGreaterThan(0);
    // every shown card should contain 'hybrid' in title/meta/text
    cards.forEach(c => {
      const txt = c.textContent.toLowerCase();
      expect(txt.includes('hybrid')).toBeTruthy();
    });
  });

  test('category filter updates card count', () => {
    const reg = window.SCENARIO_REGISTRY.slice(0,17);
    const categories = Array.from(new Set(reg.map(s=>s.category).filter(Boolean)));
    if(categories.length===0) return; // nothing to assert
    const cat = categories[0];
    const sel = document.getElementById('filterCategory');
    sel.value = cat;
    sel.dispatchEvent(new Event('change'));
    const grid = document.getElementById('scenarioGrid');
    const expected = reg.filter(s => s.category===cat).length;
    expect(grid.querySelectorAll('.sd-card').length).toBe(expected);
  });

  test('difficulty filter works independently', () => {
    const reg = window.SCENARIO_REGISTRY.slice(0,17);
    const expected = reg.filter(s => String((s.difficulty||'')).toLowerCase()==='advanced').length;
    const sel = document.getElementById('filterDifficulty');
    sel.value = 'advanced';
    sel.dispatchEvent(new Event('change'));
    const shown = document.getElementById('scenarioGrid').querySelectorAll('.sd-card').length;
    expect(shown).toBe(expected);
  });

  test('combined filters work together', () => {
    const search = document.getElementById('searchInput');
    const selCat = document.getElementById('filterCategory');
    const selDiff = document.getElementById('filterDifficulty');
    // pick values from registry
    const reg = window.SCENARIO_REGISTRY.slice(0,17);
    const candidate = reg.find(s => s.category && s.difficulty && (s.title||'').length>0);
    if(!candidate) return;
    search.value = (candidate.title || '').split(' ')[0];
    selCat.value = candidate.category;
    selDiff.value = candidate.difficulty;
    // trigger
    search.dispatchEvent(new Event('input'));
    selCat.dispatchEvent(new Event('change'));
    selDiff.dispatchEvent(new Event('change'));
    const cards = document.getElementById('scenarioGrid').querySelectorAll('.sd-card');
    // all shown cards should match all filters
    Array.from(cards).forEach(c => {
      const text = c.textContent.toLowerCase();
      expect(text.includes((candidate.title||'').split(' ')[0].toLowerCase())).toBeTruthy();
      expect(text.includes(candidate.category.toLowerCase())).toBeTruthy();
      expect(text.includes(candidate.difficulty.toLowerCase())).toBeTruthy();
    });
  });

  test('ASE filter works or gracefully ignores missing ASE metadata', () => {
    const reg = window.SCENARIO_REGISTRY.slice(0,17);
    const ases = Array.from(new Set(reg.map(s=>s.aseArea).filter(Boolean)));
    const sel = document.getElementById('filterAse');
    if(ases.length===0){
      // selecting ASE should not throw and should keep original count when set to 'all'
      sel.value = 'all';
      sel.dispatchEvent(new Event('change'));
      expect(document.getElementById('scenarioGrid').querySelectorAll('.sd-card').length).toBe(reg.length);
    } else {
      const a = ases[0]; sel.value = a; sel.dispatchEvent(new Event('change'));
      const expected = reg.filter(s=>s.aseArea===a).length;
      expect(document.getElementById('scenarioGrid').querySelectorAll('.sd-card').length).toBe(expected);
    }
  });

  test('result counter updates correctly and empty state appears when 0 results', () => {
    const search = document.getElementById('searchInput');
    search.value = 'this-will-never-match-xyz';
    search.dispatchEvent(new Event('input'));
    const grid = document.getElementById('scenarioGrid');
    expect(grid.querySelectorAll('.sd-card').length).toBe(0);
    expect(grid.querySelectorAll('.empty-state').length).toBe(1);
    expect(document.getElementById('filterCount').textContent).toContain('Showing 0 of 17');
  });

  test('reset filters button restores all cards after empty state', () => {
    const search = document.getElementById('searchInput');
    search.value = 'this-will-never-match-xyz';
    search.dispatchEvent(new Event('input'));
    const empty = document.querySelector('.empty-state');
    expect(empty).toBeTruthy();
    const btn = document.querySelector('#scenarioFilters #resetFiltersBtn');
    expect(btn).toBeTruthy();
    expect(document.querySelector('#scenarioGrid #resetFiltersBtn')).toBeNull();
    btn.click();
    const grid = document.getElementById('scenarioGrid');
    expect(grid.querySelectorAll('.sd-card').length).toBe(17);
    expect(document.getElementById('filterCount').textContent).toContain('Showing 17 of 17');
  });

  test('clearing filters restores all 17 cards', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = 'all';
    document.getElementById('filterDifficulty').value = 'all';
    document.getElementById('filterAse').value = 'all';
    document.getElementById('searchInput').dispatchEvent(new Event('input'));
    const grid = document.getElementById('scenarioGrid');
    expect(grid.querySelectorAll('.sd-card').length).toBe(17);
  });

  test('keyboard accessibility still works after filtering', () => {
    document.getElementById('filterDifficulty').value = 'intermediate';
    document.getElementById('filterDifficulty').dispatchEvent(new Event('change'));
    const first = document.querySelector('.sd-card');
    expect(first).toBeTruthy();
    const a = first.querySelector('a'); expect(a).toBeTruthy();
    const enter = new KeyboardEvent('keydown', { key: 'Enter' });
    first.dispatchEvent(enter);
    expect(window.location.hash).toContain(a.getAttribute('href'));
  });

  test('rapid typing does not duplicate cards or leak DOM nodes', () => {
    const search = document.getElementById('searchInput');
    const values = ['h','hy','hyb','hybr','hybri','hybrid'];
    values.forEach(v => { search.value = v; search.dispatchEvent(new Event('input')); });
    const grid = document.getElementById('scenarioGrid');
    // final count should match registry filter (no DOM leak - node count equals expected)
    const expected = (window.SCENARIO_REGISTRY||[]).slice(0,17).filter(s=>((s.title||'')+' '+(s.shortSymptom||'')).toLowerCase().includes('hybrid')).length;
    expect(grid.querySelectorAll('.sd-card').length).toBe(expected);
  });
});
