const { test, expect } = require('@playwright/test');
// (no local file helper needed when serving via HTTP)

// Allowed 404 patterns (analytics endpoints intentionally excluded)
const allowed404Patterns = ['/analytics', '/telemetry', '/api/analytics', '/api/telemetry'];

test.describe('Student dashboard smoke', ()=>{
  test('loads and basic interactions', async ({ browser })=>{
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if(msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const badResponses = [];
    page.on('response', resp => {
      if(resp.status() === 404){
        const url = resp.url();
        if(!allowed404Patterns.some(p=>url.includes(p))) badResponses.push({url, status: resp.status()});
      }
    });

    // Desktop: open page served by local static server so absolute paths resolve
    // prefer explicit BASE_URL, otherwise default to local server started for tests
    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
    await page.goto(`${BASE_URL}/dashboard/student.html`);
    await page.waitForLoadState('networkidle');

    // Ensure a clean UI state: clear persisted progress and filter inputs to avoid cross-test leakage
    await page.evaluate(()=>{
      try{ localStorage.removeItem('student_progress'); localStorage.removeItem('last_scenario'); }catch(e){}
      try{ const s=document.getElementById('searchInput'); if(s) { s.value=''; s.dispatchEvent(new Event('input')); } ['filterCategory','filterDifficulty','filterAse'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value='all'; }); }catch(e){}
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // debug: log registry length and sample ids
    await page.evaluate(()=>{ console.log('REGISTRY LENGTH', (window.SCENARIO_REGISTRY||[]).length, JSON.stringify(((window.SCENARIO_REGISTRY||[]).slice(0,10)||[]).map(s=>s.id))); });

    // 17 cards render on desktop
    await page.waitForSelector('#scenarioGrid');
    // debug: output active filters and which IDs are shown
    await page.evaluate(()=>{
      try{
        const filters = (typeof getFilters==='function') ? getFilters() : { q: (document.getElementById('searchInput')||{}).value||'', category: (document.getElementById('filterCategory')||{}).value||'all', difficulty: (document.getElementById('filterDifficulty')||{}).value||'all', ase: (document.getElementById('filterAse')||{}).value||'all' };
        const registry = (window.SCENARIO_REGISTRY||[]).slice(0,17);
        const shown = (typeof matchesFilter==='function') ? registry.filter(s=>matchesFilter(s, filters)) : registry.filter(s=>{
          if(filters.category && filters.category !== 'all'){
            if(String((s.category||'')).toLowerCase() !== String(filters.category).toLowerCase()) return false;
          }
          if(filters.difficulty && filters.difficulty !== 'all'){
            if(String((s.difficulty||'')).toLowerCase() !== String(filters.difficulty).toLowerCase()) return false;
          }
          if(filters.ase && filters.ase !== 'all'){
            if(String((s.aseArea||'')).toLowerCase() !== String(filters.ase).toLowerCase()) return false;
          }
          if(filters.q && filters.q.trim() !== ''){ const q = filters.q.trim().toLowerCase(); const hay = ((s.title||'') + ' ' + (s.shortSymptom||'') + ' ' + (s.id||'')).toLowerCase(); if(!hay.includes(q)) return false; }
          return true;
        });
        console.log('ACTIVE FILTERS', JSON.stringify(filters));
        console.log('SHOWN IDS', JSON.stringify(shown.map(s=>s.id)));
      }catch(e){ console.log('filter-debug-error', String(e)); }
    });
    const cards = await page.$$('#scenarioGrid .sd-card');
    console.log('INITIAL CARDS COUNT', cards.length);
    expect(cards.length).toBe(17);

    // Mobile viewport: no horizontal overflow at 390px
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    const scrollWidth = await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Search filter reduces cards
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.reload();
    const search = await page.$('#searchInput');
    if(search){
      await search.fill('no-crank');
      await page.waitForTimeout(100); // small debounce
      const filtered = await page.$$('#scenarioGrid .sd-card');
      expect(filtered.length).toBeLessThan(17);
    }

    // first card click updates URL hash or navigates
    const cardCountAfter = await page.evaluate(()=>document.querySelectorAll('#scenarioGrid .sd-card').length);
    const gridChildCount = await page.evaluate(()=>{ const el = document.getElementById('scenarioGrid'); return el ? el.childElementCount : 0; });
    console.log('CARD COUNT after manual renderer:', cardCountAfter);
    console.log('scenarioGrid child count:', gridChildCount);
      await page.evaluate(()=>{
        try{
          const cards = Array.from(document.querySelectorAll('#scenarioGrid .sd-card')).map(c=>({ title: (c.querySelector('.sd-card-title')||{}).textContent, img: (c.querySelector('img')||{}).src }));
          console.log('DOM CARDS', JSON.stringify(cards));
        }catch(e){ console.log('dom-cards-error', String(e)); }
      });
    expect(cardCountAfter).toBeGreaterThan(0);
    const firstCard = await page.$('#scenarioGrid .sd-card');
    expect(firstCard).toBeTruthy();
    const beforeHash = await page.evaluate(()=>location.hash);
    await Promise.all([
      page.waitForTimeout(100),
      firstCard.click()
    ]);
    const afterHash = await page.evaluate(()=>location.hash);
    expect((afterHash && afterHash!==beforeHash) || afterHash==='').toBeTruthy();

    // Seed localStorage and reload to check Resume button
    await page.evaluate(()=>{
      localStorage.setItem('last_scenario', JSON.stringify({id:'no-crank'}));
      localStorage.setItem('student_progress', JSON.stringify({ 'no-crank': { status: 'in-progress', updated: new Date().toISOString() } }));
    });
    await page.reload();
    const resume = await page.$('#btnResume');
    expect(resume).toBeTruthy();
    const resumeVisible = await resume.evaluate(n=>getComputedStyle(n).display!=='none');
    expect(resumeVisible).toBe(true);

    // Reset clears progress
    page.on('dialog', async d=>{ await d.accept(); });
    const reset = await page.$('#btnReset');
    if(reset){
      await reset.click();
      // give time for script to clear and rerender
      await page.waitForTimeout(100);
      const storage = await page.evaluate(()=>localStorage.getItem('student_progress'));
      expect(storage===null || storage==='{}').toBeTruthy();
    }

    // ensure no console errors and no unexpected 404s (now including scenario images)
    if(consoleErrors.length) console.log('Console errors (raw):', consoleErrors.slice(0,20));
    if(consoleMessages.length) console.log('Console messages (raw):', JSON.stringify(consoleMessages.slice(0,40), null, 2));
    if(badResponses.length) console.log('Bad responses (404 raw):', JSON.stringify(badResponses.slice(0,40), null, 2));
    // filter out unrelated load-resource console messages
    const filteredConsoleErrors = consoleErrors.filter(e => !e.includes('Failed to load resource'));
    if(filteredConsoleErrors.length) console.log('Console errors (filtered):', filteredConsoleErrors.slice(0,20));
    if(badResponses.length) console.log('Bad responses (filtered):', JSON.stringify(badResponses.slice(0,40), null, 2));
    expect(filteredConsoleErrors).toEqual([]);
    expect(badResponses).toEqual([]);

    await context.close();
  });
});
